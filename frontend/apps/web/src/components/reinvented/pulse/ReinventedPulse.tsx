'use client';

// The one Pulse tab as it opens (Pulse, reinvented, phase 1, board B1), shown only while `pulse_reinvented` is on for the
// person (PulsePick); today's Pulse is untouched beside it. A list laid over a live map: the list rests at three heights
// (the middle, how it opens; List, full; Map, full with the list tucked down), pulled by its handle or set by the
// switch. At desktop width the list and the map sit side by side. One request draws the first screen
// (GET /api/reinvented/list, coord/CONTRACT.md §6a).

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { ChevronDown, Headphones, LocateFixed, Plus } from 'lucide-react';
import * as api from '@pantopus/api';
import type { Post } from '@pantopus/api';
import { useMe } from '@/lib/me';
import { useMyHomeCenter } from '@/lib/myHomes';
import { reactedPostPatch, serverReactionPatch } from '@/components/feed/PostReactions';
import { studioViewer } from '../viewer/studioViewer';
import { isSwitchedOff, useRereadSwitch } from '../switchOff';
import { useBackWhenMissing } from '../serverBehind';
import { isChip, readAtlasBox, readExplore, readList, readMap, readStrip, type Box, type ExploreItem, type ExplorePage, type ListMoment, type Chip, type ListItem, type ListPage, type MapTime, type Point, type Reach } from './listApi';
import MomentRow from './MomentRow';
import PostRow from './PostRow';
import { itemPoint, type FlyTarget } from './PulseMap';
import { PeekDeck, TimeRow } from './MapDeck';
import { explorePins, keptPins, pinsOf, roundBox, type Pin } from './pins';
import ExploreView from './ExploreView';
import AtlasView, { AtlasItem, dropFromAtlas } from './AtlasView';
import AliveStrip from './AliveStrip';
import { useLinkedMoment, useLinkedSky } from './momentLinks';
import { useHandBackToMoments } from '../handBack';
import { readBeams, readSounds } from './mapLight';
import AskTheMap, { type Lit } from './AskTheMap';
import FollowedPlaces, { useFollow } from './FollowedPlaces';
import Constellations from './Constellations';
import Echoes from '../echoes/Echoes';
import Windows from '../circles/Windows';
import ReachDial from './ReachDial';
import { FilterRow, FilterSheet, NO_FILTERS, filterCount, filterParams, useKeptFilters, type Kind } from './filters';
import { DeckNav, deckOf } from '../deck/StepDeck';
import { retakeOf } from '../retake/RetakeView';
import { convergenceOf, convergenceTitle } from '../sky/Convergence';
import { pinboardOf } from '../pinboard/Pinboard';
import '@/components/moments/moments.css';
import './pulse.css';

const PulseMap = dynamic(() => import('./PulseMap'), { ssr: false, loading: () => <div className="rp-map" /> });
const MomentViewer = dynamic(() => import('@/components/moments/MomentViewer'), { ssr: false });
// One camera for everything (phase 1 piece 11): + opens the Studio, where a Moment or, with "+ Ask / Kind", a post is made.
const Composer = dynamic(() => import('../MomentComposerEntry'), { ssr: false });
const Studio = dynamic(() => import('../studio/Studio'), { ssr: false });
const RetakeView = dynamic(() => import('../retake/RetakeView'), { ssr: false });
const ConvergenceView = dynamic(() => import('../sky/Convergence'), { ssr: false });
const PinboardView = dynamic(() => import('../pinboard/Pinboard'), { ssr: false });
// Tonight in <town> (CONTRACT 8k): the town's film of the day, from 8 pm, on Around me.
const TownFilm = dynamic(() => import('./TownFilm'), { ssr: false });
// Open Eyes-on Asks near where the reader is now (CONTRACT 8f), on Around me.
const EyesOnNear = dynamic(() => import('../eyeson/EyesOnNear'), { ssr: false });
// Place relics near where the reader is now (CONTRACT 8g), on Around me.
const RelicsNear = dynamic(() => import('../seal/RelicsNear'), { ssr: false });

type Height = 'middle' | 'list' | 'map';
const UP: Record<Height, Height> = { map: 'middle', middle: 'list', list: 'list' };
const DOWN: Record<Height, Height> = { list: 'middle', middle: 'map', map: 'map' };

const REACH_NAMES: Record<Reach, string> = { close: 'Close circle', around: 'Around me', explore: 'The world' };

type ListData = InfiniteData<ListPage, string | null>;
type ExploreData = InfiniteData<ExplorePage, string | null>;

export default function ReinventedPulse() {
  const router = useRouter();
  const client = useQueryClient();
  const reread = useRereadSwitch();
  // The "+" Studio's words go to today's Moments if the switch is found off while it is open (handBack.ts).
  const handBack = useHandBackToMoments();
  const me = useMe();
  const account = me.data?.id ?? null;
  const home = useMyHomeCenter();
  const [reach, setReach] = useState<Reach>('around');
  // One of the person's circles inside Close circle (CONTRACT 8d); null is all their connections.
  const [circle, setCircle] = useState<{ id: string; name: string } | null>(null);
  const [height, setHeight] = useState<Height>('middle');
  const [point, setPoint] = useState<Point | null>(null);
  const [locating, setLocating] = useState<'idle' | 'busy' | 'refused'>('idle');
  const [viewing, setViewing] = useState<{ id: string; ids: string[] } | null>(null);
  const [time, setTime] = useState<MapTime>('live');
  // Filters (PHASE-5 B, CONTRACT 10a): kept on this device for this person; the time row is their When.
  const { filters, setFilters, since, ready: filtersRead } = useKeptFilters(account, time, setTime);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const filtered = filterCount(filters, time) > 0;
  const listFilters = useMemo(() => filterParams(filters, time, since, 'list'), [filters, time, since]);
  const mapFilters = useMemo(() => filterParams(filters, time, since, 'map'), [filters, time, since]);
  const filterKey = JSON.stringify(listFilters);
  // A single kind on is today's chip for the rows that follow one (Eyes on, Relics…); several or none is All.
  const chip: Chip = filters.kinds.length === 1 ? filters.kinds[0] : 'all';
  const shows = (k: Kind) => !filters.kinds.length || filters.kinds.includes(k);
  // The row steps aside while the list scrolls down and comes back when it scrolls up.
  const [rowHidden, setRowHidden] = useState(false);
  const lastTop = useRef(0);
  const [box, setBox] = useState<Box | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // Pulse, or My Atlas (the switch's third choice): the person's own kept Moments in the list's place and on the map.
  const [view, setView] = useState<'pulse' | 'atlas'>('pulse');
  const [atlasItem, setAtlasItem] = useState<ListMoment | null>(null);
  const [fly, setFly] = useState<FlyTarget | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const closeDial = useCallback(() => setScopeOpen(false), []);
  const [miles, setMiles] = useState(25);
  const [toast, setToast] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // A Retake opened from its row, and one being added to (CONTRACT 8e).
  const [retakeOpen, setRetakeOpen] = useState<string | null>(null);
  // A convergence (CONTRACT 8h) opened from its row.
  const [skyOpen, setSkyOpen] = useState<string | null>(null);
  // A pinboard (CONTRACT 8i) opened from its row, and one being added to.
  const [boardOpen, setBoardOpen] = useState<string | null>(null);
  const [addingPiece, setAddingPiece] = useState<{ id: string; prompt: string } | null>(null);
  const [addingFrame, setAddingFrame] = useState<{ id: string; title: string; ghost: string | null } | null>(null);
  // Answering an Eyes-on Ask with a Live photo (CONTRACT 8f).
  const [answering, setAnswering] = useState<{ id: string; question: string } | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  // Ask the map (CONTRACT 9b): the pins lit for the words asked; the rest dim. Cleared with a new reach, view or time.
  const [lit, setLit] = useState<Lit | null>(null);
  // Listen to the town (CONTRACT 9g): off until the reader turns it on; the map's place sounds for its box and time.
  const [listening, setListening] = useState(false);
  useEffect(() => setLit(null), [reach, view, time]);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  // At desktop width the list sits beside the map (pulse.css), so it covers none of it.
  const [sideBySide, setSideBySide] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const read = () => setSideBySide(wide.matches);
    read();
    wide.addEventListener('change', read);
    return () => wide.removeEventListener('change', read);
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const circleId = reach === 'close' ? circle?.id ?? null : null;
  const key = useMemo(
    () => ['reinvented', 'list', account, reach, reach === 'around' ? miles : null, filterKey, point?.latitude ?? null, point?.longitude ?? null, circleId] as const,
    [account, reach, miles, filterKey, point, circleId],
  );
  const list = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) => readList({ reach, miles, chip: 'all', cursor: pageParam, point, circle: circleId, filters: listFilters }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: !!account && filtersRead && reach !== 'explore',
    staleTime: 30_000,
    retry: (count, error) => !isSwitchedOff(error) && count < 1,
  });
  // Explore (CONTRACT §6f): its own read, a page at a time, pausing with "Keep exploring?" instead of running on.
  const explore = useInfiniteQuery({
    queryKey: ['reinvented', 'explore', account, point?.latitude ?? null, point?.longitude ?? null],
    queryFn: ({ pageParam, signal }) => readExplore({ cursor: pageParam, point }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: !!account && reach === 'explore',
    staleTime: 60_000,
    retry: (count, error) => !isSwitchedOff(error) && count < 1,
  });
  useEffect(() => {
    if (explore.error && isSwitchedOff(explore.error)) void reread();
  }, [explore.error, reread]);
  const explored = useMemo(() => {
    const pages = explore.data?.pages || [];
    return {
      followed: pages[0]?.followed || [],
      picked: pages[0]?.picked || [],
      items: pages.flatMap((p) => p.items),
      pause: pages[pages.length - 1]?.pause ?? null,
    };
  }, [explore.data]);
  const exploreAll = useMemo(() => [...explored.followed, ...explored.picked, ...explored.items], [explored]);
  const exploreMoments = useMemo(() => exploreAll.flatMap((i) => (i.type === 'moment' ? [i.moment] : [])), [exploreAll]);
  // What the map fits itself to in Explore: the Moments and posts listed, wherever in the world they are.
  const exploreListItems = useMemo<ListItem[]>(
    () =>
      exploreAll.map((i): ListItem => (i.type === 'moment' ? { type: 'moment', id: i.id, band: null, moment: i.moment } : { type: 'post', id: i.id, band: null, post: i.post })),
    [exploreAll],
  );
  // The switch went off between two reads: read it again, and PulsePick puts today's Pulse back.
  useEffect(() => {
    if (list.error && isSwitchedOff(list.error)) void reread();
  }, [list.error, reread]);
  // The list's first page has come (or failed) once. The map's marks and the strip wait for it, so nothing goes out beside
  // what opens the tab (LEAD-2 09:22: they follow the first page, never precede it).
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (list.data || list.error) setOpened(true);
  }, [list.data, list.error]);

  // The map's own read for the box in view and the time row's choice (CONTRACT §6b); it follows the list's first page.
  const map = useQuery({
    queryKey: ['reinvented', 'map', account, time, box, mapFilters],
    queryFn: ({ signal }) => readMap(box!, time, signal, mapFilters),
    enabled: !!account && filtersRead && !!box && view === 'pulse' && reach !== 'explore' && opened,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: (count, error) => !isSwitchedOff(error) && count < 1,
  });
  useEffect(() => {
    if (map.error && isSwitchedOff(map.error)) void reread();
  }, [map.error, reread]);
  const sounds = useQuery({
    queryKey: ['reinvented', 'sounds', account, time, box],
    queryFn: ({ signal }) => readSounds(box!, time, signal),
    enabled: listening && !!account && !!box && view === 'pulse' && reach !== 'explore',
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
  });
  // Live beams in the box (CONTRACT 9h), on the live map only. A server without the route draws none.
  const beams = useQuery({
    queryKey: ['reinvented', 'beams', account, box],
    queryFn: ({ signal }) => readBeams(box!, signal),
    // Only after the list's first page has come, so nothing competes with what opens the tab (LEAD-3 11:05).
    enabled: !!account && !!box && view === 'pulse' && reach !== 'explore' && time === 'live' && !!list.data,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
    retry: false,
  });
  const atlasMap = useQuery({
    queryKey: ['reinvented', 'atlas-box', account, box],
    queryFn: ({ signal }) => readAtlasBox(box!, signal),
    enabled: !!account && !!box && view === 'atlas',
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: (count, error) => !isSwitchedOff(error) && count < 1,
  });
  const pins = useMemo(
    () => (view === 'atlas' ? keptPins(atlasMap.data?.moments) : reach === 'explore' ? explorePins(exploreAll) : pinsOf(map.data)),
    [view, reach, atlasMap.data, exploreAll, map.data],
  );
  // Alive right now (CONTRACT §6c), over the list; it follows the list's first page like the map.
  const strip = useQuery({
    queryKey: ['reinvented', 'strip', account, point?.latitude ?? null, point?.longitude ?? null],
    queryFn: ({ signal }) => readStrip(point, signal),
    enabled: !!account && opened,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: (count, error) => !isSwitchedOff(error) && count < 1,
  });
  useEffect(() => {
    if (strip.error && isSwitchedOff(strip.error)) void reread();
  }, [strip.error, reread]);
  // A circle the person is no longer in answers 404 CIRCLE_NOT_FOUND: back to all their connections, not to today's Pulse.
  const circleGone = (list.error as { code?: string } | null)?.code === 'CIRCLE_NOT_FOUND';
  useEffect(() => {
    if (circleGone) setCircle(null);
  }, [circleGone]);
  // A server older than this website answers these reads 404: back to today's Pulse at once, as on the switch going off.
  useBackWhenMissing(circleGone ? null : list.error, map.error, strip.error, explore.error);
  // A box with no height (the map laid out before the sheet settles, at phone width) is never read: the server answers
  // 400 to it.
  const onBox = useCallback((b: Box) => {
    const r = roundBox(b);
    if (r.north > r.south && r.east > r.west) setBox(r);
  }, []);

  const pages = list.data?.pages;
  const first = pages?.[0];
  const items = useMemo(() => pages?.flatMap((p) => p.items) ?? [], [pages]);
  // With filters on, Heads-ups always come back (CONTRACT 10a): a list of only those is still an empty result.
  const onlyHeadsUps = filtered && items.length > 0 && items.every((i) => i.type === 'post' && i.post.post_type === 'alert');
  const last = pages?.[pages.length - 1];
  // The chips this reach and place have something for, as the first page names them; kept while another chip loads.
  const [chips, setChips] = useState<Chip[]>(['all']);
  useEffect(() => {
    if (first?.chips) setChips(first.chips.filter(isChip));
  }, [first?.chips]);
  const bandLabels = useMemo(() => new Map((first?.bands || []).map((b) => [b.band, b.label])), [first?.bands]);

  // More as the list nears its end.
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return undefined;
    const watch = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { root: scroller.current, rootMargin: '600px 0px' },
    );
    watch.observe(el);
    return () => watch.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, items.length]);

  // A new reach or other filters start the list from its top, with the row in view.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setRowHidden(false);
  }, [reach, filterKey]);

  // ── Posts: today's card, its answers patched into this list's pages ──
  const patchPost = useCallback(
    (id: string, patch: (p: Post) => Partial<Post>) => {
      client.setQueriesData<ListData>({ queryKey: ['reinvented', 'list'] }, (old) =>
        old && {
          ...old,
          pages: old.pages.map((pg) => ({
            ...pg,
            items: pg.items.map((it) => (it.type === 'post' && it.post.id === id ? { ...it, post: { ...it.post, ...patch(it.post) } } : it)),
          })),
        },
      );
      // The same post in Explore (a Studio post shown anywhere): the same card, so the same answer.
      const inExplore = <T extends ExploreItem>(it: T): T => (it.type === 'post' && it.post.id === id ? { ...it, post: { ...it.post, ...patch(it.post) } } : it);
      client.setQueriesData<ExploreData>({ queryKey: ['reinvented', 'explore'] }, (old) =>
        old && { ...old, pages: old.pages.map((pg) => ({ ...pg, picked: pg.picked && pg.picked.map(inExplore), items: pg.items.map(inExplore) })) },
      );
    },
    [client],
  );
  const dropItem = useCallback(
    (id: string) => {
      client.setQueriesData<ListData>({ queryKey: ['reinvented', 'list'] }, (old) =>
        old && { ...old, pages: old.pages.map((pg) => ({ ...pg, items: pg.items.filter((it) => it.id !== id) })) },
      );
      client.setQueriesData<ExploreData>({ queryKey: ['reinvented', 'explore'] }, (old) =>
        old && {
          ...old,
          pages: old.pages.map((pg) => ({ ...pg, picked: pg.picked && pg.picked.filter((it) => it.id !== id), items: pg.items.filter((it) => it.id !== id) })),
        },
      );
    },
    [client],
  );
  const postOf = useCallback(
    (id: string) =>
      items.find((it): it is Extract<ListItem, { type: 'post' }> => it.type === 'post' && it.post.id === id)?.post ||
      exploreAll.find((it): it is Extract<ExploreItem, { type: 'post' }> => it.type === 'post' && it.post.id === id)?.post,
    [items, exploreAll],
  );
  const busy = useCallback(async (id: string, work: () => Promise<void>) => {
    setBusyIds((s) => new Set(s).add(id));
    try {
      await work();
    } finally {
      setBusyIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }, []);
  const openPost = useCallback((id: string) => router.push(`/app/feed/post/${encodeURIComponent(id)}`), [router]);
  const card = {
    currentUserId: account ?? undefined,
    surface: reach === 'close' ? 'connections' : 'place',
    showToast: setToast,
    onComment: openPost,
    onOpenDetail: openPost,
    onLike: (id: string) => {
      const before = postOf(id);
      if (!before || busyIds.has(id)) return;
      const liked = !before.userHasLiked;
      patchPost(id, (p) => ({ userHasLiked: liked, like_count: Math.max(0, (p.like_count ?? 0) + (liked ? 1 : -1)) }));
      void busy(id, async () => {
        try {
          const res = await api.posts.toggleLike(id, liked);
          patchPost(id, () => ({ userHasLiked: res.liked, like_count: res.likeCount }));
        } catch {
          patchPost(id, () => ({ userHasLiked: before.userHasLiked, like_count: before.like_count }));
          setToast('Couldn’t save that. Try again.');
        }
      });
    },
    onReact: (id: string, reaction: string | null) => {
      const before = postOf(id);
      if (!before || busyIds.has(id)) return;
      patchPost(id, (p) => reactedPostPatch(p, reaction));
      void busy(id, async () => {
        try {
          const res = await api.posts.setReaction(id, reaction);
          patchPost(id, (p) => serverReactionPatch(res, p.reactions));
        } catch {
          patchPost(id, () => ({ reactions: before.reactions, userReaction: before.userReaction, userHasLiked: before.userHasLiked, like_count: before.like_count }));
          setToast('Couldn’t update your reaction. Try again.');
        }
      });
    },
    onSave: (id: string) => {
      const before = postOf(id);
      if (!before) return;
      const saved = !before.userHasSaved;
      patchPost(id, () => ({ userHasSaved: saved }));
      api.posts.toggleSave(id, saved).catch(() => {
        patchPost(id, () => ({ userHasSaved: before.userHasSaved }));
        setToast('Couldn’t save that. Try again.');
      });
    },
    onDelete: (id: string) => {
      api.posts
        .deletePost(id)
        .then(() => dropItem(id))
        .catch(() => setToast('Couldn’t delete the post. Try again.'));
    },
    onHide: (id: string) => {
      api.posts
        .hidePost(id)
        .then(() => {
          dropItem(id);
          setToast('Post hidden.');
        })
        .catch(() => setToast('Couldn’t hide the post. Try again.'));
    },
    onSolved: (id: string) => patchPost(id, () => ({ state: 'solved' }) as Partial<Post>),
  };

  // ── Moments ──
  // A step deck (§7g) is one row, its first step in the list, and the viewer goes through all its steps from there.
  // A Retake (CONTRACT 8e) is one row too: its first frame in the list opens the whole Retake.
  const shown = useMemo(() => {
    const seen = new Set<string>();
    return items.filter((it) => {
      if (it.type !== 'moment') return true;
      const deck = deckOf(it.moment);
      const retake = retakeOf(it.moment);
      const sky = convergenceOf(it.moment);
      const board = pinboardOf(it.moment);
      const key = deck
        ? `${it.moment.author?.id}:${deck.id}`
        : retake
          ? `retake:${retake.start_id}`
          : sky
            ? `sky:${sky.id}`
            : board
              ? `board:${board.start_id}`
              : null;
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [items]);
  const momentIds = useMemo(
    () =>
      [
        ...new Set(
          shown.flatMap((it) => {
            if (it.type !== 'moment') return [];
            const steps = deckOf(it.moment)?.steps;
            return steps?.length ? steps : [it.id];
          }),
        ),
      ],
    [shown],
  );
  // Another step of a deck; a step opened alone (a link, a notice) gets the deck's steps as its run.
  const selectStep = useCallback(
    (id: string, steps: string[]) =>
      setViewing((v) => {
        if (!v) return v;
        const ids = v.ids.length > 1 && v.ids.includes(id) ? v.ids : steps;
        return v.id === id && ids === v.ids ? v : { id, ids };
      }),
    [],
  );
  const openMoment = useCallback(
    (id: string) => {
      // A deck's row opens at its first step; a Retake's row opens the Retake.
      const item = shown.find((it) => it.type === 'moment' && it.id === id);
      const retake = item?.type === 'moment' ? retakeOf(item.moment) : null;
      if (retake) {
        setRetakeOpen(retake.start_id);
        return;
      }
      const sky = item?.type === 'moment' ? convergenceOf(item.moment) : null;
      if (sky) {
        setSkyOpen(sky.id);
        return;
      }
      const board = item?.type === 'moment' ? pinboardOf(item.moment) : null;
      if (board) {
        setBoardOpen(board.start_id);
        return;
      }
      const steps = item?.type === 'moment' ? deckOf(item.moment)?.steps : undefined;
      const start = steps?.length ? steps[0] : id;
      setViewing({ id: start, ids: momentIds.includes(start) ? momentIds : [start] });
    },
    [momentIds, shown],
  );
  // A Moment's link (`/app/moments/<id>`, a notice, a share) arrives here as `?moment=<id>` and opens in the viewer.
  const openLinked = useCallback((id: string) => setViewing({ id, ids: [id] }), []);
  useLinkedMoment(openLinked);
  useLinkedSky(setSkyOpen);
  const openExplored = useCallback(
    (id: string) => {
      const ids = exploreMoments.map((m) => m.id);
      setViewing({ id, ids: ids.includes(id) ? ids : [id] });
    },
    [exploreMoments],
  );
  // "Follow <place>" on an Explore item (CONTRACT 9c): its place as everyone sees it, named as the item names it.
  const follow = useFollow(account ?? '');
  const followOf = useCallback(
    (item: ExploreItem) => {
      const point = item.type === 'moment' ? (item.moment.no_location ? null : itemPoint({ type: 'moment', id: item.id, band: null, moment: item.moment })) : itemPoint({ type: 'post', id: item.id, band: null, post: item.post });
      // The town the server names ("New from Kyoto"), else the place the item shows.
      const town = /^New from (.+)$/.exec(item.why || '')?.[1];
      const label = (town || (item.type === 'moment' ? item.moment.place_label : (item.post as { location_name?: string | null }).location_name))?.trim();
      if (!account || !point || !label || label === 'Nearby') return null;
      return { label, run: () => follow({ label, latitude: point.latitude, longitude: point.longitude }) };
    },
    [account, follow],
  );
  const flyTo = useCallback((p: Point) => {
    setFly({ ...p, serial: Date.now() });
    setHeight((h) => (h === 'list' ? 'middle' : h));
  }, []);

  // ── The map's pins and the peek deck ──
  const openPin = useCallback(
    (pin: Pin) => {
      if (pin.type === 'kept') setAtlasItem(pin.moment);
      else if (pin.type === 'explore') openExplored(pin.moment.id);
      else if (pin.type === 'ring') {
        const ids = pin.ring.moments.map((m) => m.id);
        if (!ids.length) return;
        const start = pin.ring.moments.find((m) => !m.seen)?.id || ids[0];
        setViewing({ id: start, ids });
      } else if (pin.type === 'mark') openPost(pin.mark.post.id);
      else router.push(`/app/plans/${encodeURIComponent(pin.ticket.id)}`);
    },
    [openPost, router, openExplored],
  );
  // At the Map height a pin chosen on the map brings its card up (a second tap opens it); elsewhere a tap opens it.
  const onPick = useCallback(
    (key: string) => {
      const pin = pins.find((p) => p.key === key);
      if (!pin) return;
      if (height === 'map' && selected !== key) setSelected(key);
      else openPin(pin);
    },
    [pins, height, selected, openPin],
  );
  const onDeckSelect = useCallback(
    (key: string) => {
      setSelected(key);
      const pin = pins.find((p) => p.key === key);
      if (pin) setFly({ ...pin.point, serial: Date.now(), keepZoom: true });
    },
    [pins],
  );

  // ── The list's three heights: pulled by the handle, or set by the switch ──
  const pull = useRef<{ y: number; moved: boolean } | null>(null);
  const onHandleDown = (e: ReactPointerEvent) => {
    pull.current = { y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleUp = (e: ReactPointerEvent) => {
    const start = pull.current;
    pull.current = null;
    if (!start) return;
    const dy = e.clientY - start.y;
    if (dy < -36) setHeight((h) => UP[h]);
    else if (dy > 36) setHeight((h) => DOWN[h]);
    else setHeight((h) => (h === 'middle' ? 'list' : 'middle'));
  };
  const pick = (to: 'list' | 'map') => {
    if (view === 'atlas') {
      setView('pulse');
      setSelected(null);
      return setHeight(to === 'map' ? 'map' : 'middle');
    }
    setHeight((h) => (h === to ? 'middle' : to));
  };
  const toAtlas = () => {
    setSelected(null);
    setView((v) => (v === 'atlas' ? 'pulse' : 'atlas'));
    setHeight((h) => (h === 'map' ? 'middle' : h));
  };

  const locate = () => {
    if (!navigator.geolocation) return setLocating('refused');
    setLocating('busy');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating('idle');
        setPoint({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => setLocating('refused'),
      { maximumAge: 60_000, timeout: 15_000 },
    );
  };

  const placeName =
    reach === 'explore' ? 'Explore' : reach === 'close' ? circle?.name || 'Your circle' : first?.place?.label || (first?.needs_place ? 'No place yet' : 'Near you');
  const fitKey = `${reach}|${miles}|${filterKey}|${point?.latitude ?? ''}|${point?.longitude ?? ''}|${(reach === 'explore' ? explore.dataUpdatedAt : list.dataUpdatedAt) ? 'read' : ''}`;
  const fallback = point ?? (home ? { latitude: home.lat, longitude: home.lng } : null);
  let prevBand: string | null = null;

  const head = (
    <header className="rp-head">
      <div className="rp-scope-wrap">
        <button
          type="button"
          className="rp-scope"
          aria-haspopup="dialog"
          aria-expanded={scopeOpen}
          onClick={() => setScopeOpen((o) => !o)}
        >
          <span className="rp-scope-dot" data-reach={reach} aria-hidden />
          <strong>{placeName}</strong>
          <span className="rp-scope-reach">{reach === 'around' && miles < 25 ? `${REACH_NAMES.around} · ${miles} mi` : REACH_NAMES[reach]}</span>
          <ChevronDown size={16} aria-hidden />
        </button>
        {scopeOpen && (
          <ReachDial
            reach={reach}
            miles={miles}
            place={first?.place?.label ?? null}
            onReach={(r) => {
              setReach(r);
              if (r !== 'close') setCircle(null);
            }}
            circle={circle?.id ?? null}
            onCircle={(c) => {
              setReach('close');
              setCircle(c);
            }}
            onMiles={setMiles}
            onClose={closeDial}
          />
        )}
      </div>

      <div className="rp-switch" role="group" aria-label="List or map">
        <button type="button" aria-pressed={view === 'pulse' && height !== 'map'} data-lit={(view === 'pulse' && height !== 'map') || undefined} onClick={() => pick('list')}>
          List
        </button>
        <button type="button" aria-pressed={view === 'pulse' && height !== 'list'} data-lit={(view === 'pulse' && height !== 'list') || undefined} onClick={() => pick('map')}>
          Map
        </button>
        <button type="button" aria-pressed={view === 'atlas'} data-lit={view === 'atlas' || undefined} onClick={toAtlas}>
          Atlas
        </button>
      </div>

      {view === 'pulse' && reach !== 'explore' && (
        <FilterRow
          filters={filters}
          time={time}
          chips={chips}
          hidden={rowHidden && height !== 'map'}
          onFilters={setFilters}
          onClear={() => {
            setFilters(NO_FILTERS);
            setTime('live');
          }}
          onOpen={() => setFiltersOpen(true)}
        />
      )}
      {view === 'pulse' && reach !== 'explore' && (height === 'map' || sideBySide) && (
        <AskTheMap box={box} time={time} data={map.data} lit={lit} shown={lit ? pins.filter((p) => lit.pins.has(p.key)).length : 0} onLit={setLit} />
      )}
      {view === 'pulse' && reach !== 'explore' && (height === 'map' || sideBySide) && (
        <div className="rp-listen">
          <button type="button" aria-pressed={listening} onClick={() => setListening((on) => !on)}>
            <Headphones size={15} aria-hidden />
            {listening ? 'Listening' : 'Listen to the town'}
          </button>
          {listening && (
            <small role="status">
              {sounds.data?.sounds.length
                ? 'Put on headphones and move across the map, or tap a ♪: you hear the sounds people kept here.'
                : sounds.isFetching
                  ? 'Finding sounds…'
                  : 'No sounds kept here. Move the map.'}
            </small>
          )}
        </div>
      )}
    </header>
  );

  return (
    <div className="rp-board" data-height={height}>
      <div className="rp-map-layer" aria-hidden={height === 'list' || undefined}>
        <PulseMap
          pins={pins}
          listItems={reach === 'explore' ? exploreListItems : first?.items ?? []}
          fitKey={fitKey}
          fallback={fallback}
          layoutKey={`${height}|${sideBySide}`}
          flyTo={fly}
          selected={selected}
          onBox={onBox}
          onPick={onPick}
          float={view === 'pulse' && reach !== 'explore' && !!map.data?.heights_on && !!map.data?.float_on}
          lit={view === 'pulse' && reach !== 'explore' ? lit : null}
          sounds={listening && view === 'pulse' && reach !== 'explore' ? sounds.data?.sounds ?? null : null}
          beams={view === 'pulse' && reach !== 'explore' && time === 'live' ? beams.data?.beams : undefined}
        />
      </div>
      {height === 'map' && <div className="rp-map-top">{head}</div>}
      {sideBySide && height === 'middle' && reach !== 'explore' && (
        <div className="rp-map-time">
          <TimeRow time={time} onTime={setTime} />
        </div>
      )}

      <section className="rp-sheet" aria-label="Pulse">
        <div
          className="rp-handle"
          role="button"
          tabIndex={0}
          aria-label={height === 'list' ? 'Show the map' : 'Show more of the list'}
          onPointerDown={onHandleDown}
          onPointerUp={onHandleUp}
          onPointerCancel={() => (pull.current = null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setHeight((h) => (h === 'middle' ? 'list' : 'middle'));
            } else if (e.key === 'ArrowUp') setHeight((h) => UP[h]);
            else if (e.key === 'ArrowDown') setHeight((h) => DOWN[h]);
          }}
        >
          <span />
        </div>

        {height !== 'map' && head}

        {height === 'map' && (
          <div className="rp-map-bottom">
            {reach !== 'explore' && <TimeRow time={time} onTime={setTime} />}
            {reach === 'explore' ? (
              pins.length ? (
                <PeekDeck pins={pins} selected={selected} now={now} onSelect={onDeckSelect} onOpen={openPin} />
              ) : (
                <p className="rp-deck-empty">{explore.isPending ? 'Loading Explore…' : 'Nothing from elsewhere on the map right now.'}</p>
              )
            ) : map.isError && !isSwitchedOff(map.error) ? (
              <p className="rp-deck-empty">The map couldn’t load. Move it to try again.</p>
            ) : map.data ? (
              <PeekDeck pins={pins} selected={selected} now={now} onSelect={onDeckSelect} onOpen={openPin} />
            ) : (
              <p className="rp-deck-empty">Loading the map…</p>
            )}
          </div>
        )}
        <div
          ref={scroller}
          className="rp-list"
          aria-busy={list.isFetching || undefined}
          aria-hidden={height === 'map' || undefined}
          onScroll={(e) => {
            const top = e.currentTarget.scrollTop;
            if (top > lastTop.current + 8 && top > 80) setRowHidden(true);
            else if (top < lastTop.current - 8 || top <= 80) setRowHidden(false);
            if (Math.abs(top - lastTop.current) > 8 || top <= 80) lastTop.current = top;
          }}
        >
          {view === 'atlas' && account ? (
            <AtlasView
              account={account}
              constellations={
                <Constellations
                  account={account}
                  place={fallback}
                  onRetake={setRetakeOpen}
                  onSky={setSkyOpen}
                  onMoment={(id) => setViewing({ id, ids: [id] })}
                  onPost={openPost}
                  onPlace={flyTo}
                />
              }
              onOpen={setAtlasItem}
              onFound={(m) => (m.author?.id === account ? setAtlasItem(m) : setViewing({ id: m.id, ids: [m.id] }))}
              onPlace={flyTo}
            />
          ) : reach === 'explore' ? (
            explore.isError && !isSwitchedOff(explore.error) ? (
              <div className="rp-empty">
                <p>Explore couldn’t load.</p>
                <button type="button" className="rp-button" onClick={() => void explore.refetch()}>
                  Try again
                </button>
              </div>
            ) : (
              <ExploreView
                followed={explored.followed}
                places={account ? <FollowedPlaces account={account} near={home ? { lat: home.lat, lng: home.lng } : null} /> : null}
                followOf={followOf}
                picked={explored.picked}
                items={explored.items}
                pause={explored.pause}
                loading={explore.isPending || explore.isFetchingNextPage}
                more={!!explore.hasNextPage}
                now={now}
                onMore={() => void explore.fetchNextPage()}
                onOpen={openExplored}
                onPlace={flyTo}
                renderPost={(post) => (
                  <PostRow post={post} point={itemPoint({ type: 'post', id: post.id, band: null, post })} onPlace={flyTo} card={{ ...card, isLiking: busyIds.has(post.id) }} />
                )}
              />
            )
          ) : list.isPending ? (
            <div className="rp-skeleton" role="status" aria-label="Loading Pulse">
              <span />
              <span />
              <span />
            </div>
          ) : list.isError && !isSwitchedOff(list.error) ? (
            <div className="rp-empty">
              <p>Pulse couldn’t load.</p>
              <button type="button" className="rp-button" onClick={() => void list.refetch()}>
                Try again
              </button>
            </div>
          ) : first?.needs_place ? (
            <div className="rp-empty">
              <p>Pulse shows what’s around a place. Share where you are, or add your home on Place.</p>
              <div className="rp-empty-actions">
                <button type="button" className="rp-button" onClick={locate} disabled={locating === 'busy'}>
                  <LocateFixed size={16} aria-hidden />
                  {locating === 'busy' ? 'Finding you…' : 'Use my location'}
                </button>
                <button type="button" className="rp-button rp-button-quiet" onClick={() => router.push('/app/place')}>
                  Go to Place
                </button>
              </div>
              {locating === 'refused' && <p className="rp-muted">Your browser didn’t share your location. You can allow it in its settings.</p>}
            </div>
          ) : (
            <>
              {/* Homes talk to homes (CONTRACT 9f): the circles' windows, at the top of Close circle. */}
              {reach === 'close' && account && <Windows account={account} />}
              {/* Echoes (CONTRACT 9e): nothing is pushed; in the evening, by the reader's own clock, they show here too. */}
              {reach === 'around' && account && !!first && !filters.kinds.length && new Date(now).getHours() >= 18 && (
                <Echoes account={account} onOpen={(id) => setViewing({ id, ids: [id] })} />
              )}
              {reach === 'around' && account && shows('live') && (
                <TownFilm account={account} place={fallback} ready={!!first} now={now} onPlay={(ids, start) => setViewing({ id: start, ids })} />
              )}
              {strip.data && shows('live') && (
                <AliveStrip
                  strip={strip.data}
                  bandLabel={(b) => (b ? bandLabels.get(b) || null : null)}
                  now={now}
                  onMoments={(ids, start) => setViewing({ id: start, ids })}
                  onPlan={(t) => router.push(`/app/plans/${encodeURIComponent(t.id)}`)}
                />
              )}
              {reach === 'around' && account && shows('ask') && (
                <EyesOnNear account={account} point={point} offer={chip === 'ask'} now={now} onAnswer={setAnswering} />
              )}
              {reach === 'around' && account && shows('spots') && (
                <RelicsNear account={account} point={point} offer={chip === 'spots'} />
              )}
              {(items.length === 0 || onlyHeadsUps) && (
                <div className="rp-empty">
                  <p>
                    {onlyHeadsUps
                      ? `Nothing else matches these filters ${reach === 'close' ? 'in your circle' : 'around you'} right now. Safety notices always show.`
                      : filtered
                      ? `Nothing matches these filters ${reach === 'close' ? 'in your circle' : 'around you'} right now.`
                      : reach === 'close'
                        ? 'Nothing from your circle right now. Their Moments and posts show here as they share them.'
                        : 'Nothing around you right now. Post the first Moment, or ask something.'}
                  </p>
                  {filtered && (
                    <div className="rp-empty-actions">
                      <button
                        type="button"
                        className="rp-button"
                        onClick={() => {
                          setFilters(NO_FILTERS);
                          setTime('live');
                        }}
                      >
                        Clear filters
                      </button>
                      {(reach === 'close' || (reach === 'around' && miles < 25)) && (
                        <button
                          type="button"
                          className="rp-button rp-button-quiet"
                          onClick={() => (reach === 'close' ? (setReach('around'), setCircle(null)) : setMiles(25))}
                        >
                          Look wider
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              <ol className="rp-items">
                {shown.map((item) => {
                  const label = item.band ? bandLabels.get(item.band) || null : null;
                  const line = reach === 'around' && item.band && item.band !== prevBand ? label : null;
                  prevBand = item.band;
                  return (
                    <li key={`${item.type}:${item.id}`}>
                      {line && (
                        <p className="rp-band" role="separator">
                          <span>{line}</span>
                        </p>
                      )}
                      {item.type === 'moment' && item.kept ? (
                        // A Moment its author kept ("Keep this?", CONTRACT 6d): a post that stays, so the bordered look.
                        <div className="rp-post rp-kept">
                          <div className="rp-post-status">
                            <span className="rp-status" data-tone="kept">
                              Kept · stays
                            </span>
                          </div>
                          <MomentRow
                            moment={item.moment}
                            bandLabel={label}
                            now={now}
                            onOpen={openMoment}
                            onPlace={flyTo}
                            kept
                            steps={deckOf(item.moment)?.count}
                            tag={
                            retakeOf(item.moment)
                              ? `Retake · ${retakeOf(item.moment)!.frames} ${retakeOf(item.moment)!.frames === 1 ? 'frame' : 'frames'}`
                              : convergenceOf(item.moment)
                                ? convergenceTitle(convergenceOf(item.moment)!)
                                : pinboardOf(item.moment)
                                  ? `Pinboard · ${pinboardOf(item.moment)!.pieces} ${pinboardOf(item.moment)!.pieces === 1 ? 'piece' : 'pieces'}`
                                  : undefined
                          }
                          />
                        </div>
                      ) : item.type === 'moment' ? (
                        <MomentRow
                          moment={item.moment}
                          bandLabel={label}
                          now={now}
                          onOpen={openMoment}
                          onPlace={flyTo}
                          steps={deckOf(item.moment)?.count}
                          tag={
                            retakeOf(item.moment)
                              ? `Retake · ${retakeOf(item.moment)!.frames} ${retakeOf(item.moment)!.frames === 1 ? 'frame' : 'frames'}`
                              : convergenceOf(item.moment)
                                ? convergenceTitle(convergenceOf(item.moment)!)
                                : pinboardOf(item.moment)
                                  ? `Pinboard · ${pinboardOf(item.moment)!.pieces} ${pinboardOf(item.moment)!.pieces === 1 ? 'piece' : 'pieces'}`
                                  : undefined
                          }
                        />
                      ) : (
                        <PostRow
                          post={item.post}
                          point={itemPoint(item)}
                          onPlace={flyTo}
                          card={{ ...card, isLiking: busyIds.has(item.post.id) }}
                          onAnswer={setAnswering}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
              <div ref={sentinel} className="rp-sentinel" />
              {isFetchingNextPage && <p className="rp-muted rp-center">Loading more…</p>}
              {!hasNextPage && last?.end && <p className="rp-end">{last.end}</p>}
            </>
          )}
        </div>
      </section>

      {!creating && (
        <button type="button" className="rp-create" aria-label="Create" title="Create" onClick={() => setCreating(true)}>
          <Plus size={24} strokeWidth={2.6} aria-hidden />
        </button>
      )}
      {skyOpen && <ConvergenceView id={skyOpen} onClose={() => setSkyOpen(null)} />}
      {boardOpen && (
        <PinboardView
          id={boardOpen}
          onClose={() => setBoardOpen(null)}
          onAdd={(start) => {
            setBoardOpen(null);
            setAddingPiece(start);
          }}
        />
      )}
      {addingPiece && account && (
        <Studio
          account={account}
          pinboardOf={addingPiece}
          onClose={() => setAddingPiece(null)}
          onDone={(msg) => {
            setAddingPiece(null);
            setToast(msg);
            void client.invalidateQueries({ queryKey: ['reinvented'] });
          }}
        />
      )}
      {retakeOpen && (
        <RetakeView
          id={retakeOpen}
          onClose={() => setRetakeOpen(null)}
          onAdd={(start) => {
            setRetakeOpen(null);
            setAddingFrame(start);
          }}
        />
      )}
      {answering && account && (
        <Studio
          account={account}
          eyesOnFor={answering}
          onClose={() => setAnswering(null)}
          onDone={(msg) => {
            setAnswering(null);
            setToast(msg);
            void client.invalidateQueries({ queryKey: ['reinvented'] });
          }}
        />
      )}
      {addingFrame && account && (
        <Studio
          account={account}
          retakeOf={addingFrame}
          onClose={() => setAddingFrame(null)}
          onDone={(msg) => {
            setAddingFrame(null);
            setToast(msg);
            void client.invalidateQueries({ queryKey: ['reinvented'] });
          }}
        />
      )}
      {filtersOpen && (
        <FilterSheet filters={filters} time={time} since={since} onFilters={setFilters} onTime={setTime} onClose={closeFilters} />
      )}
      {creating && account && (
        <Composer
          account={account}
          onHandBack={handBack}
          onClose={() => setCreating(false)}
          onDone={(msg) => {
            setCreating(false);
            setToast(msg);
            void client.invalidateQueries({ queryKey: ['reinvented'] });
          }}
        />
      )}

      {toast && (
        <div className="rp-toast" role="status">
          {toast}
        </div>
      )}

      {atlasItem && account && (
        <AtlasItem
          moment={atlasItem}
          account={account}
          onClose={() => setAtlasItem(null)}
          onDeleted={(id) => {
            setAtlasItem(null);
            dropFromAtlas(client, id);
            dropItem(id);
            setToast('Deleted for good.');
          }}
        />
      )}
      {viewing && account && (
        <DeckNav.Provider value={selectStep}>
          <MomentViewer
            key={viewing.id}
            id={viewing.id}
            account={account}
            ids={viewing.ids}
            wide={false}
            onClose={() => setViewing(null)}
            onSelect={(id) => setViewing((v) => (v ? { ...v, id } : v))}
            onSeen={() => undefined}
            onWatchedPlace={() => undefined}
            onRemove={(id) => {
              setViewing(null);
              dropItem(id);
            }}
            onPlace={(p) => {
              setViewing(null);
              flyTo(p);
            }}
            studio={studioViewer}
          />
        </DeckNav.Provider>
      )}
    </div>
  );
}
