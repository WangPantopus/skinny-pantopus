'use client';

// The Studio (Pulse, reinvented, phase 0 step 7 on the web): today's Moment composer redrawn as one full-screen
// canvas. The picture fills the frame, the tools sit on the right, and one bar at the bottom says who sees it, how long
// it stays and where, with Post. Everything today's Post settings hold is in the drawer the pill opens. It is shown
// only while the `pulse_reinvented` switch is on for the person (MomentComposerEntry); off, today's composer opens,
// unchanged. It posts the same Moment as today's composer, with the same rules and the same requests. The words on it
// are the ones the lead set for all three apps (coord/QUESTIONS.md, 2026-11-26 23:36).

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { geo, moments, penNames, posts as postsApi, upload } from '@pantopus/api';
import { post } from '@pantopus/api/client';
import type { Audience, Background, Hours, Location, NewMoment, Preview } from '@pantopus/api/endpoints/moments';
import type { MomentChatDraft } from '@pantopus/types';
import {
  ArrowRight,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crop,
  Eraser,
  EyeOff,
  Highlighter,
  Mic,
  ImagePlus,
  LocateFixed,
  MapPin,
  MessageCircleQuestion,
  MoveUpRight,
  PenLine,
  Pipette,
  Plus,
  Repeat,
  Maximize2,
  Minimize2,
  RotateCw,
  Scissors,
  Sparkles,
  Type,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import { readCaptureMetadata, type CaptureMetadata } from '@/components/feed/composer/mediaLocation';
import { useDialogFocusTrap } from '@/lib/useDialogFocusTrap';
import { withFreshFix } from '@/lib/freshPostFix';
import MomentCamera, { type CameraCapture } from '@/components/moments/MomentCamera';
import { blankArt, edited, inks, type Artwork, type Stroke } from '@/components/moments/momentArtwork';
import { offPicture, stageFrame } from './frame';
import { BlurLayer, blurInto, type BlurBox } from './BlurTool';
import { cutToShape, sideBySide } from './beforeAfter';
import { beforeAfterOf } from '../play/BeforeAfter';
import { MentionPicker, mentionIds, type Mentioned } from '../mentions/Mentions';
import {
  colors,
  deviceFix,
  distance,
  gpsLocation,
  messageOf,
  PIN_REVIEW_DISTANCE_M,
  recentFix,
  type DeviceFix,
} from '@/components/moments/momentState';
import { prepareMedia } from '@/components/moments/momentMedia';
import { discardJob, keepJob, pendingJobs, postJob, type Job } from '@/components/moments/momentOutbox';
import PenNameSetup from '@/components/penName/PenNameSetup';
import { usePenNameMe } from '@/components/penName/penName';
import StampLayer, { STAMP_TINT, StampIcon } from '../stamps/StampLayer';
import { MAX_PLAY, PLAY_MAKERS, PlayEditLayer, PlayMaker, playWire, swatchBox, type PlayStart } from '../play/PlayEdit';
import { suggestPlay } from './suggest';
import type { PlayItem, PlayKind } from '../play/playTypes';
import { SoundPanel } from '../sound/SoundPanel';
import { timedWords, uploadSound, type Recording } from '../sound/record';
import { DotEditLayer, DotEditPanel, dotsWire, MAX_DOTS, newDot, usePantopusAiOn, type DotDraft } from '../dots/DotEdit';
import { STAMP_KINDS, stampLabel, type PlacedStamp, type StampKind, type StampValues } from '../stamps/stampTypes';
import { isSwitchedOff } from '../switchOff';
import StudioPicture, { type StudioBrush, type StudioTool } from './StudioPicture';
import {
  backdropOf,
  bakePhoto,
  fillZoom,
  fitZoom,
  placementOf,
  stuckTurn,
  turnOf,
  unmoved,
  zoomRange,
  type Backdrop,
  type Placement as WholePlacement,
} from './whole';
import { composeVideo } from './wholeVideo';
import { heldTrim, TrimPanel, type TrimSpan } from './TrimPanel';
import { FILM_LOOKS, lookPreviews, photostrip, withLook, type FilmLook } from './looks';
import { fontReady, TEXT_LOOKS, type TextLook } from './fonts';
import { sampleColors } from './sampleColors';
import { fitSpan, LOOP_FIRST_MS, LOOP_MIN_MS, loopPoster, loopsFile, type LoopSpan } from '../loop/loop';
import { LoopPanel } from '../loop/LoopPanel';
import {
  ALERT_KINDS,
  asksSomething,
  asStoredWallClock,
  CONTACT_CHOICES,
  eventTimeError,
  kindHint,
  kindName,
  kindPill,
  purposeOf,
  EXPLORE_KINDS,
  MADE_UP_NAME_KINDS,
  OWN_NAME_KINDS,
  STUDIO_KINDS,
  type StudioKind,
} from './postKinds';
import './studio.css';

const PlacePreview = dynamic(() => import('@/components/moments/MomentPlacePreview'), { ssr: false });
const fallback = { max_seconds: 30, max_parts: 1, max_bytes: 50 * 1024 * 1024 };
const inkNames = ['White', 'Black', 'Yellow', 'Red', 'Blue', 'Green'];
const pens = [0.006, 0.012, 0.024];
// At home the place line reads "Area · <town>"; the first time only, one line under it says why (design §4).
const HOME_NOTE_KEY = 'pantopus.studio.homeAreaNoteSeen';
// The step deck's note to its author, said once (CONTRACT 7g): "Readers can save your steps' words."
const DECK_NOTE_KEY = 'pantopus.studio.deckNoteSeen';
type Placement = 'exact' | 'area' | 'place' | 'none';
type PostAs = 'personal' | 'pen_name';
/** What one of several pictures picked together keeps while another shows (PHASE-5 A5). */
interface KeptPicture {
  art: Artwork;
  caption: string;
  look: FilmLook;
  lookFile: File | null;
  blurs: BlurBox[];
  trimSpan: TrimSpan | null;
  mentioned: Mentioned[];
  voiceRec: Recording | null;
  voiceWords: string;
  placeRec: Recording | null;
}

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(min-width: 1000px)');
    const read = () => setWide(q.matches);
    read();
    q.addEventListener('change', read);
    return () => q.removeEventListener('change', read);
  }, []);
  return wide;
}

/**
 * A drag that means one thing (PHASE-6 F3): the Studio's details are a real sheet, opened by dragging the summary line up
 * and closed by dragging its header down. A tap stays the control's own; only a clear vertical drag does `act`.
 */
function useDragTo(direction: 'up' | 'down', act: () => void) {
  const skipClick = useRef(false);
  const stop = useRef<(() => void) | null>(null);
  const latest = useRef(act);
  latest.current = act;
  useEffect(() => () => stop.current?.(), []);
  return {
    // The press is followed on the window from the moment it lands, so a long mouse drag that leaves the summary line or
    // the header still counts (LEAD-7's look, 05:26); a tap stays the control's own click.
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      stop.current?.();
      const id = e.pointerId,
        x0 = e.clientX,
        y0 = e.clientY;
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        const dy = ev.clientY - y0,
          dx = Math.abs(ev.clientX - x0);
        // More up (or down) than sideways: a long drag that wanders off the header still counts (LEAD-7's look, 08:55).
        if ((direction === 'up' ? -dy : dy) > 28 && Math.abs(dy) > dx) {
          end();
          skipClick.current = true;
          window.setTimeout(() => (skipClick.current = false), 300);
          latest.current();
        }
      };
      const up = (ev: PointerEvent) => ev.pointerId === id && end();
      const end = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        stop.current = null;
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      stop.current = end;
    },
    // The click that ends a drag is not a tap.
    onClickCapture: (e: React.MouseEvent) => {
      if (!skipClick.current) return;
      skipClick.current = false;
      e.stopPropagation();
      e.preventDefault();
    },
  };
}

function Chip({ on, children, ...rest }: { on: boolean; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="st-chip" aria-pressed={on} {...rest}>
      {children}
    </button>
  );
}

/** A playable item where it lands on the picture; a swatch's try-on area follows its colours (§7g). */
function placedPlay(it: ReturnType<typeof playWire>[number], frame: ReturnType<typeof stageFrame>) {
  const at = frame.point(it.x, it.y);
  return { ...it, ...at, scale: frame.scale(it.scale), ...(it.kind === 'swatch' ? { box: swatchBox(at.x, at.y) } : {}) };
}

export default function Studio({
  account,
  draft = null,
  onClose,
  onDone,
  onSwitchedOff,
  retakeOf = null,
  eyesOnFor = null,
  pinboardOf = null,
}: {
  account: string;
  draft?: MomentChatDraft | null;
  onClose(): void;
  onDone(msg: string): void;
  /** The server said the switch is off for this person (CONTRACT §1): today's composer takes over with these words. */
  onSwitchedOff?(words: MomentChatDraft): void;
  /** Adding a frame to a Retake (CONTRACT 8e): its first picture shows as a ghost to line up with. */
  retakeOf?: { id: string; title: string; ghost: string | null } | null;
  /** Answering an Eyes-on Ask with a Live photo from the place (CONTRACT 8f). */
  eyesOnFor?: { id: string; question: string } | null;
  /** Adding a piece to a pinboard (CONTRACT 8i). */
  pinboardOf?: { id: string; prompt: string } | null;
}) {
  const wide = useWide();
  const [files, setFiles] = useState<File[]>([]),
    [index, setIndex] = useState(0),
    [mode, setMode] = useState<'none' | 'text' | 'media'>(draft?.kind === 'text' ? 'text' : 'none');
  const file = mode === 'media' ? files[index] : undefined;
  const [camera, setCamera] = useState(false),
    [capture, setCapture] = useState<CameraCapture | null>(null);
  const [art, setArt] = useState(blankArt),
    [text, setText] = useState(draft?.kind === 'text' ? draft.text || '' : ''),
    [caption, setCaption] = useState(''),
    [bg, setBg] = useState<Background>(draft?.kind === 'text' && draft.background ? draft.background : 'teal');
  const draftCaption = useRef(draft?.kind === 'photo' ? draft.caption || '' : '');
  const [hours, setHours] = useState<Hours>(draft?.hours ?? 24),
    [audience, setAudience] = useState<Audience>(draft?.audience ?? 'nearby'),
    [postAs, setPostAs] = useState<PostAs>('personal'),
    [placement, setPlacement] = useState<Placement>('exact');
  const [fix, setFix] = useState<DeviceFix | null>(null),
    [meta, setMeta] = useState<CaptureMetadata | null>(null),
    [reading, setReading] = useState(false);
  const [locating, setLocating] = useState(false),
    [locError, setLocError] = useState('');
  const [venue, setVenue] = useState(''),
    [venueTerm, setVenueTerm] = useState(''),
    [search, setSearch] = useState('');
  const [height, setHeight] = useState(false),
    [weather, setWeather] = useState(false),
    [later, setLater] = useState('');
  const [adult, setAdult] = useState(false),
    [homeAck, setHomeAck] = useState(false),
    [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [jobs, setJobs] = useState<Job[]>([]),
    [recovered, setRecovered] = useState(false);
  const [tool, setTool] = useState<StudioTool>(null),
    [ink, setInk] = useState(inks[0]),
    [pen, setPen] = useState(pens[1]),
    // Draw's brush, the eyedropper while it waits for a tap, and the lines as they were before each step, for Undo.
    [brush, setBrush] = useState<StudioBrush>('pen'),
    [picking, setPicking] = useState(false),
    [strokesBefore, setStrokesBefore] = useState<Stroke[][]>([]),
    // Film looks (phase 0 step 5): the look picked, this photo in it (the photo itself is kept, so another look starts
    // from it again), the tray's small copies, and a look or a photostrip being drawn.
    [look, setLook] = useState<FilmLook>('original'),
    [lookFile, setLookFile] = useState<File | null>(null),
    [lookThumbs, setLookThumbs] = useState<Partial<Record<FilmLook, string>> | null>(null),
    [lookBusy, setLookBusy] = useState(false),
    [stripBusy, setStripBusy] = useState(false),
    // Up to five colours the picture is mostly made of, beside the six inks (design: "colors sampled from the photo").
    [photoInks, setPhotoInks] = useState<string[]>([]);
  // The photo a look being drawn belongs to: a look finished after the photo changed is dropped.
  const lookFor = useRef<File | undefined>(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false),
    [discarding, setDiscarding] = useState(false),
    [askedPost, setAskedPost] = useState(false),
    [setupOpen, setSetupOpen] = useState(false),
    [stamps, setStamps] = useState<PlacedStamp[]>([]),
    [picked, setPicked] = useState<StampKind | null>(null),
    [trayOpen, setTrayOpen] = useState(false),
    // Playable items (phase 2, CONTRACT 7b) and the kind whose form is open in the tray.
    [play, setPlay] = useState<PlayItem[]>([]),
    [making, setMaking] = useState<PlayKind | 'dial' | null>(null),
    // Illuminate's suggestion (CONTRACT 7i): where the form it opens starts, and whether the person dropped it.
    [playStart, setPlayStart] = useState<PlayStart | null>(null),
    [suggestDropped, setSuggestDropped] = useState(false),
    // Illuminate (phase 2, CONTRACT 7c): dots on things in the photo, and the one being changed.
    [dots, setDots] = useState<DotDraft[]>([]),
    // The picture's own width and height, for where placed things land on it (frame.ts).
    [shape, setShape] = useState<{ w: number; h: number } | null>(null),
    // The picture's own two colours (PHASE-5 A, CONTRACT 10c): the backdrop where it doesn't reach, shown and posted.
    [backdrop, setBackdrop] = useState<Backdrop | null>(null),
    [illuminate, setIlluminate] = useState(false),
    [pickedDot, setPickedDot] = useState<string | null>(null),
    // Sound (phase 2, CONTRACT 7e): Voice Spark with its words, and place sound; sent after the Moment is made.
    [voiceRec, setVoiceRec] = useState<Recording | null>(null),
    [voiceWords, setVoiceWords] = useState(''),
    [placeRec, setPlaceRec] = useState<Recording | null>(null),
    [soundOpen, setSoundOpen] = useState(false),
    // Blur before posting (phase 2): boxes over faces, plates, numbers and labels, drawn into the photo when posting.
    [blurs, setBlurs] = useState<BlurBox[]>([]),
    // Before and after (§7g): the after photo, cut to the before's shape; its own blurs; which one the stage shows.
    [afterFile, setAfterFile] = useState<File | null>(null),
    [afterBlurs, setAfterBlurs] = useState<BlurBox[]>([]),
    [side, setSide] = useState<'before' | 'after'>('before'),
    // A step deck (§7g): the photos or videos chosen together, posted one by one as the steps of one recipe or repair.
    [asDeck, setAsDeck] = useState(false),
    [deckNote, setDeckNote] = useState(false),
    // Mentions (§7h): the connections picked after "@" in the words, and where the caret is in which field.
    [mentioned, setMentioned] = useState<Mentioned[]>([]),
    // Replies everyone can see (§8a): null keeps the server's default (on for Friends, off for Nearby).
    [repliesShown, setRepliesShown] = useState<boolean | null>(null),
    // Starting a Retake (§8e): a title makes this photo the first of one; and the ghost while adding a frame.
    [retakeTitle, setRetakeTitle] = useState(''),
    [startRetake, setStartRetake] = useState(false),
    [ghostOn, setGhostOn] = useState(true),
    // "Seal it" (§8g): the Moment opens later, on a date, where it was left, or the next time it rains there.
    [sealWhen, setSealWhen] = useState<'none' | 'date' | 'place' | 'rain'>('none'),
    [sealAt, setSealAt] = useState(''),
    // A convergence (§8h): a Live photo shared nearby may join tonight's sky; on by default, one tap to leave out.
    [joinSky, setJoinSky] = useState(true),
    // Starting a pinboard (§8i): a prompt others add their pieces to.
    [boardPrompt, setBoardPrompt] = useState(''),
    [startBoard, setStartBoard] = useState(false),
    [caretAt, setCaretAt] = useState<{ field: 'caption' | 'words'; at: number } | null>(null),
    [blurOn, setBlurOn] = useState(false),
    // Guess the spot (step 8, CONTRACT §5a): others see the picture, not the place, until they guess.
    [guessSpot, setGuessSpot] = useState(false),
    [homeNote, setHomeNote] = useState(false);
  // "+ Ask / Kind" (phase 1, CONTRACT 6d): the picture or the words become one of today's Pulse posts. Each kind's own
  // details are today's composer's (what a Heads-up is about, lost or found and how to reach the author, an event's
  // times and venue).
  const [kind, setKind] = useState<StudioKind | null>(null),
    [kindMenu, setKindMenu] = useState(false),
    [askDeclined, setAskDeclined] = useState(false),
    [alertKind, setAlertKind] = useState('other'),
    [lostType, setLostType] = useState<'lost' | 'found'>('lost'),
    [contact, setContact] = useState<'dm' | 'comment' | 'phone'>('dm'),
    [phone, setPhone] = useState(''),
    [eventStart, setEventStart] = useState(''),
    [eventEnd, setEventEnd] = useState(''),
    [eventVenue, setEventVenue] = useState(''),
    // "Also show in Explore" (phase 1, CONTRACT 6f): off by default, chosen per post.
    [exploreOn, setExploreOn] = useState(false);
  // Loop (CONTRACT 7j): the part of the video that repeats, whether its panel is open, and the video's own length.
  const [loopSpan, setLoopSpan] = useState<LoopSpan | null>(null),
    [loopOpen, setLoopOpen] = useState(false),
    [videoMs, setVideoMs] = useState<number | null>(null),
    // Trim (PHASE-5 A2): the part of a video that goes up, and whether its panel is open.
    [trimSpan, setTrimSpan] = useState<TrimSpan | null>(null),
    [trimOpen, setTrimOpen] = useState(false);
  const client = useQueryClient();
  // One id per post being made, so trying again after a failed photo upload never posts twice (today's composer).
  const postRequest = useRef<string | null>(null);
  const drawer = drawerOpen || wide;
  // PHASE-6 K1: the canvas is fitted, whole, in the room above the bottom bar, so the bar never covers it (studio.css reads
  // the bar's height from the frame).
  const footFrame = useRef<HTMLElement | null>(null);
  const footWatch = useRef<ResizeObserver | null>(null);
  const footRef = useCallback((el: HTMLDivElement | null) => {
    footWatch.current?.disconnect();
    footWatch.current = null;
    if (!el) {
      footFrame.current?.style.removeProperty('--st-foot-h');
      return;
    }
    const frame = el.closest<HTMLElement>('.st-frame');
    footFrame.current = frame;
    if (!frame) return;
    const read = () => frame.style.setProperty('--st-foot-h', `${el.offsetHeight}px`);
    read();
    footWatch.current = new ResizeObserver(read);
    footWatch.current.observe(el);
  }, []);
  useEffect(() => () => footWatch.current?.disconnect(), []);
  // PHASE-6 K3: while an item (a stamp, a playable item, a dot, the words) is dragged, the Studio's controls fade to 30% and
  // take no touches; they come back when it is let go.
  const onItemPress = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    const item = t.closest('.sp-layer[data-edit] .sp-stamp, .pl-item[data-edit], .dt-dot, .st-frame[data-tool="text"] .st-picture canvas');
    if (!item || t.closest('button:not(.dt-dot), input, textarea, select, .pl-edit-bar')) return;
    const root = e.currentTarget;
    const id = e.pointerId,
      x0 = e.clientX,
      y0 = e.clientY;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId === id && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 4) root.dataset.dragging = '';
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      delete root.dataset.dragging;
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', end, true);
      window.removeEventListener('pointercancel', end, true);
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
  };
  const dragOpen = useDragTo('up', () => setDrawerOpen(true));
  const dragClose = useDragTo('down', () => setDrawerOpen(false));
  // The eyedropper waits for one tap only while Text or Draw stays open.
  useEffect(() => setPicking(false), [tool]);
  // Undo: the lines as they were before the last line or rub; else today's step, the last line off.
  const undoStroke = () => {
    if (strokesBefore.length) {
      setArt({ ...art, strokes: strokesBefore[strokesBefore.length - 1] });
      setStrokesBefore(strokesBefore.slice(0, -1));
    } else setArt({ ...art, strokes: art.strokes.slice(0, -1) });
  };
  // A colour taken from the picture that is neither an ink nor one of the photo's own: shown as its own swatch.
  const shownColour = tool === 'draw' ? ink : art.color;
  const tookColour = !inks.includes(shownColour) && !photoInks.includes(shownColour);
  const handle = useRef<AbortController | null>(null),
    input = useRef<HTMLInputElement>(null),
    drawerRef = useRef<HTMLElement>(null),
    textInput = useRef<HTMLInputElement>(null),
    mounted = useRef(true),
    submitting = useRef(false),
    // The sound to send once the Moment exists (set as it is posted, read by deliver()).
    pendingSound = useRef<{ voice: Recording | null; words: string; place: Recording | null; whispers: { id: string; audio: Recording }[] } | null>(null);
  useEffect(() => {
    mounted.current = true;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      mounted.current = false;
      handle.current?.abort();
      document.body.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void pendingJobs(account)
      .then((j) => {
        if (active) setJobs(j);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setRecovered(true);
      });
    return () => {
      active = false;
    };
  }, [account]);
  const locate = useCallback(async () => {
    setLocating(true);
    setLocError('');
    try {
      const f = await deviceFix(0);
      if (mounted.current) setFix(f);
    } catch (e) {
      if (mounted.current) setLocError(messageOf(e, 'Location unavailable'));
    } finally {
      if (mounted.current) setLocating(false);
    }
  }, []);
  useEffect(() => {
    if (!recovered || jobs.length || !navigator.permissions) return;
    let active = true;
    void navigator.permissions
      .query({ name: 'geolocation' })
      .then((s) => {
        if (active && s.state === 'granted') void locate();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [locate, recovered, jobs.length]);
  useEffect(() => {
    let active = true;
    setMeta(null);
    setReading(!!file);
    setArt(blankArt());
    setPhotoInks([]);
    setStrokesBefore([]);
    setPicking(false);
    lookFor.current = file;
    setLook('original');
    setLookFile(null);
    setLookThumbs(null);
    setTool(null);
    setCaption(file ? draftCaption.current : '');
    if (file) draftCaption.current = '';
    setVenue('');
    setHeight(false);
    setWeather(false);
    setHomeAck(false);
    // Explore is chosen per post: each picture starts with it off.
    setExploreOn(false);
    if (file)
      void readCaptureMetadata(file).then((m) => {
        if (active) {
          setMeta(m);
          setReading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [file]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (tool === 'text') textInput.current?.focus();
  }, [tool]);
  const fromAlbum =
    file && capture?.file !== file && meta?.capturedAt && meta.latitude != null && meta.longitude != null ? meta : null;
  const point =
    placement === 'none'
      ? null
      : fromAlbum
        ? { latitude: fromAlbum.latitude!, longitude: fromAlbum.longitude! }
        : fix
          ? { latitude: fix.coords.latitude, longitude: fix.coords.longitude }
          : null;
  const marked = !!(
    file &&
    capture?.file === file &&
    capture.position &&
    point &&
    now - capture.at <= 600000 &&
    distance(point, capture.position.coords) <= 150
  );
  const preview = useQuery({
    // Today's place preview, asking also for the values the stamps would carry here (CONTRACT §2a). A server without
    // stamps drops the field and answers as today.
    queryKey: ['moments', 'preview', 'studio', account, point?.latitude, point?.longitude, marked],
    queryFn: ({ signal }) =>
      post<Preview & { stamps?: StampValues }>('/api/moments/place-preview', { ...point, weather: marked, stamps: true }, { signal }),
    retry: 1,
    staleTime: 60000,
  });
  const p = preview.data;
  // "The switch is off for you": back to today's composer with the words (the card's, or the caption).
  const handedBack = useRef(false);
  const handBack = () => {
    handedBack.current = true;
    onSwitchedOff?.(
      mode === 'text'
        ? { kind: 'text', text, background: bg, hours, audience }
        : { kind: 'photo', caption: caption.trim() || null, hours, audience },
    );
  };
  // The app read the switch off on its own while the Studio was open (before Post), and the screen holding the Studio
  // gave way to today's: what was being made goes the same way as after a refused post, so nothing typed is lost.
  const lastHandBack = useRef(handBack);
  lastHandBack.current = handBack;
  const composingNow = useRef(false);
  composingNow.current = mode === 'media' ? !!file : mode === 'text' && !!text.trim();
  useEffect(
    () => () => {
      const off = client.getQueryData<{ enabled?: boolean }>(['featureFlag', 'pulse_reinvented'])?.enabled === false;
      if (off && composingNow.current && !handedBack.current) lastHandBack.current();
    },
    [client],
  );
  // Before going back the person is told what comes with them (lead, 2026-11-27: the words, and the photo is picked
  // again in today's composer).
  const [wentOff, setWentOff] = useState(false);
  const switchedOff = isSwitchedOff(preview.error);
  useEffect(() => {
    if (switchedOff) setWentOff(true);
  }, [switchedOff]);
  useEffect(() => {
    if (p?.adult_confirmed) setAdult(true);
  }, [p?.adult_confirmed]);
  async function confirmAge() {
    if (busy) return;
    setBusy('Confirming…');
    setError('');
    try {
      await moments.confirmAdult();
      if (mounted.current) {
        setAdult(true);
        void preview.refetch();
      }
    } catch (e) {
      if (mounted.current) setError(messageOf(e, 'Couldn’t confirm eligibility.'));
    } finally {
      if (mounted.current) setBusy('');
    }
  }
  const limits = useQuery({
    queryKey: ['moments', 'limits', account],
    queryFn: moments.limits,
    staleTime: 60000,
    retry: false,
  });
  // The made-up name (docs/product/made-up-names/README.md, "Moments"): the person's own name for it, whether they may
  // use one, and, once picked, whether this spot has enough homes around it.
  const underPenName = postAs === 'pen_name';
  const penMe = usePenNameMe(true).data;
  const penCheck = useQuery({
    queryKey: ['pen-names', 'check', point?.latitude, point?.longitude],
    enabled: underPenName && !!point,
    queryFn: () => penNames.check(point!.latitude, point!.longitude),
    retry: false,
    staleTime: 60000,
  });
  const area = placement === 'area' || !!(p?.sky && p.at_home),
    noPlace = placement === 'none';
  const attested = !!p?.adult_confirmed || adult;
  const live = !underPenName && marked && !p?.at_home && !area && !noPlace;
  const altitude = fromAlbum ? fromAlbum.altitude : fix?.coords.altitude;
  const canHeight = !underPenName && point && p?.can_show_height && altitude != null && (!area || p.sky);
  const homeWarning = !underPenName && point && p?.at_home && !p.sky && !area;
  // Stamps (CONTRACT §2): the values the server would fill here, less what it keeps out on posting, so the tray and the
  // picture never show a stamp that won't be on the Moment. An album item isn't "now"; a Moment shared later doesn't
  // say when its author was there.
  const sv = p?.stamps;
  const albumItem = mode === 'media' && !!file && capture?.file !== file;
  const notNow = !!p?.at_home || noPlace || albumItem || !!later;
  const elevationFt =
    altitude != null && !p?.at_home && !noPlace && !underPenName && !(area && !p?.sky)
      ? Math.round((altitude * 3.28084) / (area ? 100 : 10)) * (area ? 100 : 10)
      : null;
  // A library photo that says when it was taken is stamped with that time, as the server does; otherwise now.
  const takenAt = albumItem && meta?.capturedAt ? new Date(meta.capturedAt) : null;
  const zone = sv?.time?.zone;
  const when =
    takenAt && !Number.isNaN(takenAt.getTime())
      ? {
          date_label: takenAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: zone }),
          label: takenAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone }),
        }
      : null;
  const stampValue = (kind: StampKind): unknown => {
    if (!sv && kind !== 'elevation') return null;
    switch (kind) {
      case 'postmark':
        return noPlace || !sv?.postmark
          ? null
          : {
              ...sv.postmark,
              ...(when ? { date_label: when.date_label, time_label: when.label } : {}),
              weather: notNow ? null : sv.postmark.weather,
              ...(later ? { time_label: '' } : {}),
            };
      case 'weather':
      case 'sunset':
        return notNow ? null : sv?.[kind] || null;
      case 'time':
        return later || !sv?.time ? null : when ? { ...sv.time, ...when } : sv.time;
      case 'place':
        return noPlace ? null : sv?.place || null;
      case 'home_distance':
        return noPlace || underPenName ? null : sv?.home_distance || null;
      case 'elevation':
        return elevationFt == null ? null : { altitude_ft: elevationFt, label: `${elevationFt.toLocaleString()} ft` };
    }
  };
  const kept = stamps.filter((st) => stampValue(st.kind) != null);
  // Guess the spot takes a photo or video with a place, never at home (the answer would point at it).
  const isVideo = !!file && (file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(file.name));
  // A post is one photo or the words. Under a made-up name a post is words only, of its own four kinds, to people
  // nearby (made-up-names contract; LEAD-2 03:03), so there the Studio offers those for the words.
  const kindsOffered =
    !retakeOf && !eyesOnFor && !pinboardOf && (underPenName ? mode === 'text' : (mode === 'media' && !!file && !isVideo && files.length === 1) || mode === 'text');
  const kindChoices = underPenName ? MADE_UP_NAME_KINDS : OWN_NAME_KINDS;
  const postKind = kindsOffered && kind && kindChoices.includes(kind) ? kind : null;
  // Playable items and dots go on a Moment, or on a Pulse post with its one photo (the new Pulse draws them over it,
  // #5009); a words-only post has no picture to carry them. A thing to name needs a photo and the author's Pantopus AI
  // on; a link isn't for a made-up name.
  const playOn = !postKind || (mode === 'media' && !!file && !isVideo);
  const canIlluminate = mode === 'media' && !!file && (!postKind || !isVideo);
  const aiOn = usePantopusAiOn(canIlluminate);
  // The same choice for Illuminate's suggestion, which also reads a text card's words (one shared read).
  const suggestAiOn = usePantopusAiOn(mode !== 'none');
  // Sound goes on a photo or video Moment under the person's own name (a voice tells who someone is), not yet on a post.
  const canSound = canIlluminate && !postKind && !underPenName;
  const canBlur = mode === 'media' && !!file && !isVideo;
  // Boxes belong to one photo: a new picture starts with none.
  useEffect(() => setBlurs([]), [file]);
  // A loop goes on a picked MP4 or QuickTime video, never one the browser recorded, and only one short enough to post
  // whole (a longer one goes out in parts). Each video starts without one; another tool opening closes its panel.
  const loopMax = limits.data?.video.max_seconds || fallback.max_seconds;
  // A trimmed video has picked its part; a loop picks its own (one or the other).
  const canLoop = mode === 'media' && !!file && isVideo && capture?.file !== file && loopsFile(file) && !trimSpan;
  const loopFits = videoMs != null && videoMs >= LOOP_MIN_MS && videoMs / 1000 - 0.025 <= loopMax;
  const loopOut = canLoop && loopFits && loopSpan && videoMs != null ? fitSpan(loopSpan, videoMs) : null;
  useEffect(() => {
    setLoopSpan(null);
    setLoopOpen(false);
    setVideoMs(null);
    setTrimSpan(null);
    setTrimOpen(false);
  }, [file]);
  const canTrim = mode === 'media' && !!file && isVideo && !loopSpan;
  const trimOut = canTrim ? heldTrim(trimSpan, videoMs) : null;
  useEffect(() => {
    if (tool || illuminate || soundOpen || trayOpen) {
      setLoopOpen(false);
      setTrimOpen(false);
    }
  }, [tool, illuminate, soundOpen, trayOpen]);
  // Opened, the loop is on: the first three seconds (or the whole of a shorter video), as soon as the length is known.
  useEffect(() => {
    if (loopOpen && !loopSpan && loopFits && videoMs != null) setLoopSpan({ from_ms: 0, to_ms: Math.min(LOOP_FIRST_MS, videoMs) });
  }, [loopOpen, loopSpan, loopFits, videoMs]);
  // Before and after goes on one photo (the before), with the after beside it in the same picture.
  const canPair = canBlur && files.length === 1 && look === 'original';
  const pairItem = beforeAfterOf(play);
  const hasPair = !!pairItem;
  const pair = hasPair && !!afterFile && canPair;
  const showAfter = pair && side === 'after';
  // A step deck: two to four photos or videos chosen together, under the person's own name, as Moments.
  const deckOffered = mode === 'media' && files.length >= 2 && files.length <= 4 && !underPenName && !postKind;
  const deckOn = asDeck && deckOffered;
  // Film looks go on one photo (not a video, a before and after, or a step deck), as on the iPhone.
  const offersLooks = canBlur && !hasPair && !deckOn;
  // The photostrip: this photo and up to three photos picked with it, one under the other, as one picture and one
  // Moment. Offered before anything is drawn, placed or blurred on this photo, as on the iPhone.
  const stripPartners =
    offersLooks && look === 'original' && !edited(art) && !blurs.length && !stamps.length && !play.length
      ? files.slice(index + 1).filter((f) => f.type.startsWith('image/') && !/\.(heic|heif)$/i.test(f.name)).slice(0, 3)
      : [];
  // The tray's small copies of the photo in each look, made once per photo when the tray opens. A photo the browser
  // can't read offers no looks.
  useEffect(() => {
    if (!trayOpen || !offersLooks || !file || lookThumbs) return undefined;
    let live = true;
    lookPreviews(file).then(
      (made) => live && setLookThumbs(made),
      () => live && setLookThumbs({}),
    );
    return () => {
      live = false;
    };
  }, [trayOpen, offersLooks, file, lookThumbs]);
  async function pickFilmLook(next: FilmLook) {
    if (!file || next === look || lookBusy) return;
    if (next === 'original') {
      setLook('original');
      setLookFile(null);
      return;
    }
    const from = file;
    setLookBusy(true);
    try {
      const made = await withLook(from, next);
      if (!mounted.current || lookFor.current !== from) return;
      setLook(next);
      setLookFile(made);
    } catch (e) {
      if (mounted.current) setError(messageOf(e, 'This look couldn’t be drawn.'));
    } finally {
      if (mounted.current) setLookBusy(false);
    }
  }
  async function makeStrip() {
    if (!file || !stripPartners.length || stripBusy) return;
    const from = file,
      partners = stripPartners;
    setStripBusy(true);
    try {
      const strip = await photostrip([from, ...partners]);
      if (!mounted.current) return;
      // The strip takes this photo's place; the photos in it leave the queue ("2 of 3" counts Moments).
      setFiles((old) =>
        old[index] !== from ? old : [...old.slice(0, index), strip, ...old.slice(index + 1).filter((f) => !partners.includes(f))],
      );
      setTrayOpen(false);
    } catch (e) {
      if (mounted.current) setError(messageOf(e, 'This strip couldn’t be made.'));
    } finally {
      if (mounted.current) setStripBusy(false);
    }
  }
  const deckId = useRef<string | null>(null);
  useEffect(() => {
    setAsDeck(false);
    deckId.current = null;
  }, [files]);
  function chooseDeck(on: boolean) {
    setAsDeck(on);
    if (on) deckId.current ??= crypto.randomUUID();
    if (!on) return;
    try {
      if (localStorage.getItem(DECK_NOTE_KEY)) return;
    } catch {
      /* private window: say it each time */
    }
    setDeckNote(true);
  }
  // A new before, or the item taken off: the after goes with it. A recording belongs to its own picture too (each step
  // of a deck has its own voice tip).
  useEffect(() => {
    setMentioned([]);
    setVoiceRec(null);
    setVoiceWords('');
    setPlaceRec(null);
    setAfterFile(null);
    setAfterBlurs([]);
    setSide('before');
    setPlay((old) => (old.some((p) => p.kind === 'before_after') ? old.filter((p) => p.kind !== 'before_after') : old));
  }, [file]);
  // Several picked at once (PHASE-5 A5): each picture keeps its own fit, words, drawing, caption, look, blurs, trim and
  // recordings while the author moves between them; put back here, after the resets above, when one shows again.
  const keptPictures = useRef(new Map<File, KeptPicture>()),
    posted = useRef(new Set<File>());
  useEffect(() => {
    const k = file ? keptPictures.current.get(file) : undefined;
    if (!k) return;
    lookFor.current = file;
    setArt(k.art);
    setCaption(k.caption);
    setLook(k.look);
    setLookFile(k.lookFile);
    setBlurs(k.blurs);
    setTrimSpan(k.trimSpan);
    setMentioned(k.mentioned);
    setVoiceRec(k.voiceRec);
    setVoiceWords(k.voiceWords);
    setPlaceRec(k.placeRec);
  }, [file]);
  useEffect(() => {
    keptPictures.current.clear();
    posted.current.clear();
  }, [files]);
  useEffect(() => {
    if (hasPair) return;
    setAfterFile(null);
    setAfterBlurs([]);
    setSide('before');
  }, [hasPair]);
  async function addAfter(item: PlayItem, after: File) {
    if (!shape) {
      setError('Wait for the photo to load, then add the after.');
      return;
    }
    try {
      const cut = await cutToShape(after, shape);
      if (!mounted.current) return;
      setAfterFile(cut);
      setAfterBlurs([]);
      setPlay((old) => [...old.filter((p) => p.kind !== 'before_after'), item]);
      setSide('after');
    } catch (e) {
      if (mounted.current) setError(messageOf(e, 'This photo couldn’t be opened.'));
    }
  }
  /** The picture that goes out: the before as prepared, with the after beside it when there is a before and after. */
  async function withAfter(prepared: { file: Blob }) {
    if (!pair || !afterFile) return prepared;
    setBusy('Putting before and after side by side…');
    const after = afterBlurs.length ? await blurInto(afterFile, afterBlurs) : afterFile;
    return { file: await sideBySide(prepared.file, after, art) };
  }
  // Mentions go out under the person's own name only (a mention says who they know).
  const canMention = !underPenName;
  const captionRef = useRef<HTMLInputElement>(null),
    wordsRef = useRef<HTMLTextAreaElement>(null);
  function followCaret(field: 'caption' | 'words', el: HTMLInputElement | HTMLTextAreaElement) {
    setCaretAt({ field, at: el.selectionStart ?? el.value.length });
  }
  function pickMention(field: 'caption' | 'words', next: { text: string; caret: number; person: Mentioned }) {
    if (field === 'caption') setCaption(next.text);
    else setText(next.text);
    setMentioned((old) => (old.some((p) => p.id === next.person.id) ? old : [...old, next.person]));
    setCaretAt({ field, at: next.caret });
    const el = field === 'caption' ? captionRef.current : wordsRef.current;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.caret, next.caret);
    });
  }
  // A Retake starts on one photo Moment with its exact place (not the area, not without one), under one's own name.
  const retakeOffered = !retakeOf && mode === 'media' && !!file && !isVideo && files.length === 1 && !underPenName && !noPlace && !area && !postKind;
  // Eyes on (§8f): an Ask about a picked public place, open six hours to people who are there now.
  const [eyesOn, setEyesOn] = useState(false);
  const eyesOnOffered = postKind === 'ask_local' && !underPenName;
  const eyesOnPlaced = placement === 'place' && venue.startsWith('osm:');
  const sealOffered = !retakeOf && !eyesOnFor && !postKind && !underPenName && (mode === 'media' || mode === 'text');
  // Where it was left and the next rain need its exact place, on a photo or words.
  const sealPlaceOk = !noPlace && !area && !isVideo;
  const sealOut =
    !sealOffered || sealWhen === 'none'
      ? {}
      : sealWhen === 'date'
        ? sealAt && Date.parse(sealAt) > Date.now()
          ? { seal: { opens: 'date' as const, at: new Date(sealAt).toISOString() } }
          : {}
        : sealPlaceOk
          ? { seal: { opens: sealWhen } }
          : {};
  const boardOffered = !retakeOf && !eyesOnFor && !pinboardOf && !postKind && !underPenName && mode === 'media' && !!file && !isVideo;
  const boardOut = pinboardOf
    ? { pinboard_of: pinboardOf.id }
    : boardOffered && startBoard && boardPrompt.trim()
      ? { pinboard: { prompt: boardPrompt.trim().slice(0, 80) } }
      : {};
  const skyOffered = !retakeOf && !eyesOnFor && !postKind && !underPenName && mode === 'media' && !!file && !isVideo && audience !== 'connections' && !noPlace && !area;
  const retakeOut = retakeOf ? { retake_of: retakeOf.id } : retakeOffered && startRetake && retakeTitle.trim() ? { retake: { title: retakeTitle.trim().slice(0, 60) } } : {};
  /** The items that go out: a before and after only with its after photo. */
  const playOut = pair ? play : play.filter((p) => p.kind !== 'before_after');
  // Stamps, Play and dots are placed on the 9:16 stage; a picture posted at its own shape gets them where the stage drew it.
  // Stamps, playable items and dots go anywhere on the canvas (PHASE-6 F2). One placed off the picture's own box makes the
  // Moment go up in its canvas form, so readers see it where it was put.
  const itemsOff =
    mode === 'media' && !!file && !edited(art) &&
    offPicture(shape, [...stamps, ...play, ...dots].map((it) => ({ x: it.x as number, y: it.y as number })));
  const frame = stageFrame(shape, mode !== 'media' || !file || edited(art) || itemsOff);
  const words = mode === 'text' ? text : caption;
  // Illuminate's suggestion (CONTRACT 7i, the table all three apps use): one chip at most, worked out here from what the
  // Studio holds; nothing is sent. Only while Pantopus AI is on for the person, never once the post carries a playable
  // item or is a step deck, and not again for this post once dropped.
  const suggestion =
    suggestAiOn && !suggestDropped && !play.length && !deckOn && !busy && mode !== 'none'
      ? suggestPlay({
          caption: words,
          picked: mode === 'media' ? files.length : 0,
          photosOnly: mode === 'media' && files.every((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)),
          photo: mode === 'media' && !!file && !isVideo,
          deckMayGo: deckOffered && index === 0,
          pairMayGo: playOn && canBlur && look === 'original' && files.length === 2 && index === 0,
          playMayGo: playOn,
        })
      : null;
  const deckBox = useRef<HTMLInputElement>(null);
  function takeSuggestion() {
    if (!suggestion) return;
    if (suggestion.kind === 'deck') {
      // The step deck's own form is its choice in the drawer: open it there.
      setDrawerOpen(true);
      requestAnimationFrame(() => {
        deckBox.current?.scrollIntoView({ block: 'center' });
        deckBox.current?.focus();
      });
      return;
    }
    const start: PlayStart =
      suggestion.kind === 'poll'
        ? { text: words.trim().slice(0, 100), options: suggestion.choices }
        : suggestion.kind === 'guess'
          ? { text: words.trim().slice(0, 100), number: true }
          : suggestion.kind === 'question'
            ? { text: words.trim().slice(0, 100) }
            : suggestion.kind === 'swatch'
              ? { colors: photoInks }
              : { text: 'Before', second: 'After', afterPhoto: files[1] };
    setPlayStart(start);
    setMaking(suggestion.kind);
    setTrayOpen(true);
  }
  // Words that ask something offer to keep the post until it's answered (CONTRACT 6d: the app's own chip).
  const offerAsk = kindsOffered && !kind && !askDeclined && asksSomething(words);
  // A post shows at its place to people nearby, or goes to the author's connections with no place (today's composer).
  const postPlaced = !noPlace && audience !== 'connections';
  // Explore is offered only with a place, to people nearby, away from home and under one's own name; for a post, only a
  // Spot, Learning or Event (never an Ask, Heads-up or Lost and found: they stay tied to the place). Never with Guess
  // the spot, whose place is the answer. The server checks all of it again and drops it otherwise.
  const exploreOffered =
    !underPenName &&
    !noPlace &&
    audience === 'nearby' &&
    !!point &&
    !!p &&
    !p.at_home &&
    !(guessSpot && !postKind) &&
    (!postKind || EXPLORE_KINDS.includes(postKind));
  const toExplore = exploreOffered && exploreOn;
  const canGuess = !postKind && mode === 'media' && !!file && !noPlace && !!point && !p?.at_home;
  // Wet red ink while the Moment is live from here (the camera, just now, where it was taken); dried otherwise.
  const stampInk: 'wet' | 'dry' = live && !later ? 'wet' : 'dry';
  function placeStamp(kind: StampKind) {
    setTrayOpen(false);
    if (stamps.some((st) => st.kind === kind)) {
      setStamps(stamps.filter((st) => st.kind !== kind));
      setPicked(null);
      return;
    }
    // A free spot near the middle, clear of the tool rail (top right) and of the stamps
    // already down; the postmark low on the left, as on board B2.
    const slots =
      kind === 'postmark'
        ? [[0.27, 0.66], [0.27, 0.42], [0.72, 0.66]]
        : [[0.38, 0.52], [0.38, 0.45], [0.38, 0.38], [0.38, 0.31], [0.64, 0.6], [0.64, 0.52], [0.38, 0.8]];
    const near = (x: number, y: number) =>
      kept.some((st) => Math.abs(st.x - x) < (st.kind === 'postmark' || kind === 'postmark' ? 0.25 : 0.2) && Math.abs(st.y - y) < (st.kind === 'postmark' || kind === 'postmark' ? 0.12 : 0.06));
    const [x, y] = slots.find(([sx, sy]) => !near(sx, sy)) || slots[0];
    setStamps([...stamps, { kind, x, y, scale: 1, rotation: kind === 'postmark' ? -9 : 0 }]);
    setPicked(kind);
  }
  useEffect(() => {
    const t = setTimeout(() => setSearch(venueTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [venueTerm]);
  const venues = useQuery({
    queryKey: ['moments', 'venues', account, point?.latitude, point?.longitude, search],
    enabled: placement === 'place' && !!point,
    queryFn: ({ signal }) =>
      search.length >= 2 ? geo.searchPlaces(search, point, signal) : geo.nearbyPlaces(point!.latitude, point!.longitude, signal),
    retry: false,
    staleTime: 30000,
  });
  const pickedVenue = venues.data?.places.find((v) => v.place_id === venue);
  const shownPoint = area
    ? p?.area
    : placement === 'place' && pickedVenue
      ? { latitude: pickedVenue.center.lat, longitude: pickedVenue.center.lng }
      : point;
  const nearby =
    venues.data?.places.filter(
      (v) =>
        v.place_id?.startsWith('osm:') &&
        point &&
        distance(point, { latitude: v.center.lat, longitude: v.center.lng }) <= (p?.pick_within_m || 0),
    ) || [];
  // At home with the Sky on, the Moment shows as the area: say why the first time only.
  useEffect(() => {
    if (!(p?.at_home && p.sky) || noPlace || mode === 'none') return;
    try {
      if (localStorage.getItem(HOME_NOTE_KEY)) return;
      localStorage.setItem(HOME_NOTE_KEY, '1');
    } catch {
      /* private window: say it each time */
    }
    setHomeNote(true);
  }, [p?.at_home, p?.sky, noPlace, mode]);

  // A text look: its font is fetched first, so the picture never shows the words in a stand-in font.
  async function pickLook(look: TextLook) {
    await fontReady(look.font, art.text);
    if (!mounted.current) return;
    setArt((a) => {
      const { font: _old, ...rest } = a;
      return look.font ? { ...rest, font: look.font } : rest;
    });
  }
  function choose(items: File[]) {
    const valid = items.filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('video/') || /\.(heic|heif|mov|mp4)$/i.test(f.name),
    );
    if (!valid.length) {
      setError('Choose a photo or video.');
      return;
    }
    setError('');
    setCapture(null);
    setFiles(valid);
    setIndex(0);
    setMode('media');
  }
  // Under the made-up name: people nearby only, never without a place, and no height, Live mark or weather.
  function choosePenName() {
    setPostAs('pen_name');
    setAudience('nearby');
    if (placement === 'none') setPlacement('exact');
    setHeight(false);
    setWeather(false);
    setError('');
  }
  function pickWho(who: 'nearby' | 'friends' | 'pen') {
    setError('');
    if (who !== 'pen') {
      setPostAs('personal');
      setAudience(who === 'friends' ? 'connections' : 'nearby');
    } else if (!penMe) return;
    else if (!penMe.allowed) setError(penMe.refusal?.message || 'This account can’t post under a made-up name.');
    else if (penMe.pen_name) choosePenName();
    else setSetupOpen(true);
  }
  /** The next picture not posted yet, `step` along (wrapping), or -1 when every other one is posted. */
  function nextUnposted(step: number) {
    for (let n = 1; n < files.length; n++) {
      const to = (((index + step * n) % files.length) + files.length) % files.length;
      if (!posted.current.has(files[to])) return to;
    }
    return -1;
  }
  // Moving between the pictures picked together keeps this one as it is (each its own fit). A step deck keeps its
  // order, and a before and after is one picture with its after.
  const canBrowse = mode === 'media' && !!file && files.length > 1 && !deckOn && !pair && !busy;
  function browse(step: number) {
    const to = canBrowse ? nextUnposted(step) : -1;
    if (to < 0 || !file) return;
    keptPictures.current.set(file, { art, caption, look, lookFile, blurs, trimSpan, mentioned, voiceRec, voiceWords, placeRec });
    setIndex(to);
  }
  // The keyboard's left and right keys do the same, unless a field or slider has them.
  useEffect(() => {
    if (!canBrowse || tool) return;
    const onKey = (e: KeyboardEvent) => {
      const at = e.target instanceof Element ? e.target : null;
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || at?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft') browse(-1);
      else if (e.key === 'ArrowRight') browse(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  async function deliver(job: Job, signal: AbortSignal) {
    const result = await postJob(job, signal, (s) => {
      if (mounted.current) setBusy(s);
    });
    // Sound goes to the Moment once it exists (CONTRACT 7e); the Moment stands even if a sound doesn't make it.
    const sounds = pendingSound.current;
    pendingSound.current = null;
    let soundFailed = false;
    if (sounds && result[0]?.id) {
      if (mounted.current) setBusy('Adding sound…');
      const id = result[0].id;
      // One at a time: each one is written into the Moment's own record, and two at once could lose one.
      const sends: (() => Promise<unknown>)[] = [];
      if (sounds.voice) sends.push(() => uploadSound(id, sounds.voice!, 'voice', { words: timedWords(sounds.words, sounds.voice!.ms) }));
      else if (sounds.place) sends.push(() => uploadSound(id, sounds.place!, 'place'));
      for (const w of sounds.whispers) sends.push(() => uploadSound(id, w.audio, 'whisper', { dot: w.id }));
      for (const send of sends) {
        try {
          await send();
        } catch {
          soundFailed = true;
        }
      }
    }
    if (!mounted.current) return;
    setJobs((old) => old.filter((j) => j.id !== job.id));
    // A step of a deck went out: the author has had the note about saving steps' words.
    const step = (job.parts[0]?.body as { deck?: { index: number; count: number } } | undefined)?.deck;
    if (step)
      try {
        localStorage.setItem(DECK_NOTE_KEY, '1');
      } catch {
        /* private window: the note shows again next time */
      }
    const state = result.find((m) => m.state !== 'live')?.state;
    const msg =
      state === 'scheduled'
        ? 'Moment scheduled.'
        : state === 'held'
          ? 'This Moment is on hold.'
          : state === 'checking'
            ? 'Media received. Your Moment is being checked.'
            : state === 'ended'
              ? 'This Moment has ended.'
              : step
                ? `Step ${step.index} of ${step.count} shared.`
                : 'Moment shared.';
    if (soundFailed) setError(msg + ' Its sound couldn’t be added.');
    if (file) {
      posted.current.add(file);
      keptPictures.current.delete(file);
    }
    const next = file && !deckOn ? nextUnposted(1) : file && index + 1 < files.length ? index + 1 : -1;
    if (next >= 0) {
      setIndex(next);
      setBusy('');
      setError(msg + (step ? ` Review step ${step.index + 1}.` : ' Review the next item.'));
    } else onDone(msg);
  }
  /**
   * The picture as it goes up, as the author composed it on the first screen (PHASE-5 A, CONTRACT 10c). A photo left as
   * it was picked, with nothing drawn on it, goes up as taken (today's path, at its own shape and full size); a moved,
   * sized, turned or drawn-on one goes up as the 9:16 canvas on its backdrop. A video keeps its own file and its
   * `placement` on the canvas; only words or drawing on it make it again as the drawn canvas (wholeVideo.ts). The same
   * numbers draw the preview (StudioPicture), so what the author sees is what readers get.
   */
  async function composed(source: File, signal: AbortSignal): Promise<{ prepared: Awaited<ReturnType<typeof prepareMedia>>; placement: WholePlacement | null }> {
    const videoLimits = limits.data?.video || fallback;
    if (!(source.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(source.name))) {
      if (!edited(art) && !itemsOff) return { prepared: await prepareMedia(source, art, videoLimits, signal, () => {}), placement: null };
      return { prepared: [{ file: await bakePhoto(source, art, backdrop) }], placement: null };
    }
    const drawn = !!(art.strokes.length || art.text.trim());
    const trim = trimOut ? { from: trimOut.from_ms / 1000, to: trimOut.to_ms / 1000 } : null;
    const video = drawn || trim
      ? await composeVideo(source, {
          drawn: drawn ? { art, backdrop } : null,
          trim,
          limits: videoLimits,
          signal,
          progress: (f) => setBusy((drawn ? 'Drawing your video · ' : 'Trimming your video · ') + Math.round(f * 100) + '%'),
        })
      : source;
    const prepared = await prepareMedia(video, blankArt(), videoLimits, signal, (f) =>
      setBusy('Preparing video · ' + Math.round(f * 100) + '%'),
    );
    return { prepared, placement: !drawn && (!unmoved(art) || itemsOff) && shape ? placementOf(shape.w, shape.h, art) : null };
  }
  async function submit(retry?: Job) {
    if (submitting.current) return;
    submitting.current = true;
    const controller = new AbortController();
    handle.current = controller;
    setBusy('Preparing…');
    setError('');
    // The Studio's own upload, once kept in the outbox: taken out again if the server says the switch is off, so
    // today's composer never offers to resume a Moment it can't post.
    let made: Job | null = retry || null;
    try {
      if (retry) {
        await deliver(retry, controller.signal);
        return;
      }
      if (!p || !attested) throw new Error('Confirm you are 18 or older to post.');
      if (!noPlace && !point) throw new Error('Choose Use my location, or select No location.');
      if (noPlace && p.has_connections === false) throw new Error('A Moment without a location needs a connection.');
      if (homeWarning && !homeAck) throw new Error('Confirm the pin at your home, or choose Show area.');
      if (underPenName && penCheck.data && !penCheck.data.allowed)
        throw new Error(penCheck.data.refusal?.message || 'A made-up name can’t post from here.');
      const kind =
        mode === 'text'
          ? 'text'
          : file && (file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name))
            ? 'video'
            : 'photo';
      // The look's font is in before the words are drawn into the picture that is posted.
      if (file && art.text.trim()) await fontReady(art.font, art.text);
      // As the author composed it (PHASE-5 A, CONTRACT 10c): see `composed` below.
      const shaped = file ? await composed(canBlur && blurs.length ? await blurInto(lookFile ?? file, blurs) : lookFile ?? file, controller.signal) : null;
      let prepared = shaped?.prepared ?? [];
      if (pair && prepared.length === 1) prepared = [await withAfter(prepared[0])];
      // Shown whole, on its backdrop, on every screen (a before and after keeps its own two-halves look).
      const wholeOut =
        shaped && !pair
          ? { whole: true as const, ...(backdrop ? { backdrop } : {}), ...(shaped.placement ? { placement: shaped.placement } : {}) }
          : {};
      // A loop is one short video, and its still is the frame where it starts (CONTRACT 7j).
      if (loopOut && prepared.length > 1) throw new Error('A loop is one short video. Take the loop off to post this video in parts.');
      if (loopOut && prepared.length === 1) {
        const still = await loopPoster(prepared[0].file, loopOut.from_ms, controller.signal);
        if (still) prepared = [{ ...prepared[0], poster: still }];
      }
      controller.signal.throwIfAborted();
      if (underPenName && prepared.length > 1)
        throw new Error("A video posted in parts can't go out under a made-up name. Post one of up to a minute.");
      if (deckOn && prepared.length > 1)
        throw new Error(`A step's video can be up to ${limits.data?.video.max_seconds || fallback.max_seconds} seconds. Choose a shorter one.`);
      let gps = fix;
      if (!noPlace && !fromAlbum && gps && !recentFix(gps.timestamp)) {
        setBusy('Updating your location…');
        const newFix = await deviceFix(0, controller.signal);
        controller.signal.throwIfAborted();
        setFix(newFix);
        if (distance(gps.coords, newFix.coords) > PIN_REVIEW_DISTANCE_M) {
          setHomeAck(false);
          setVenue('');
          setHeight(false);
          setWeather(false);
          throw new Error('Your location changed. Review the updated pin and share again.');
        }
        gps = newFix;
      }
      const loc: Location = noPlace
        ? { source: 'none' }
        : fromAlbum
          ? { source: 'capture', latitude: fromAlbum.latitude!, longitude: fromAlbum.longitude!, taken_at: fromAlbum.capturedAt! }
          : gpsLocation(gps!);
      const count = Math.max(1, prepared.length),
        series = crypto.randomUUID();
      const job: Job = {
        id: crypto.randomUUID(),
        account,
        created: Date.now(),
        parts: Array.from({ length: count }, (_, i) => {
          // `post_as`: the server's field for the made-up name (routes/moments.js), sent only when it is picked.
          // `stamps` and `elevation` (CONTRACT §2b): where each stamp sits; the server fills the values.
          const body: NewMoment & {
            post_as?: 'pen_name';
            guess?: true;
            explore?: true;
            stamps?: PlacedStamp[];
            elevation?: { meters: number; accuracy_m?: number | null; speed_mps?: number | null };
            loop?: LoopSpan;
            whole?: true;
            placement?: WholePlacement;
            backdrop?: Backdrop;
          } = {
            client_request_id: crypto.randomUUID(),
            kind,
            hours,
            audience: noPlace ? 'connections' : underPenName ? 'nearby' : audience,
            location: loc,
            ...(underPenName ? { post_as: 'pen_name' as const } : {}),
            ...(canGuess && guessSpot ? { guess: true as const } : {}),
            ...(kind === 'text'
              ? { text: text.trim(), background: bg }
              : (caption.trim() || (canSound && voiceRec && voiceWords.trim())) && i === 0
                ? { caption: (caption.trim() || voiceWords.trim()).slice(0, 100) }
                : {}),
            ...(!underPenName && repliesShown != null ? { replies_shown: repliesShown } : {}),
            ...(i === 0 ? retakeOut : {}),
            ...(i === 0 ? sealOut : {}),
            ...(i === 0 ? boardOut : {}),
            ...(i === 0 && skyOffered && joinSky ? { join_convergence: true } : {}),
            ...(i === 0 && eyesOnFor ? { eyes_on_for: eyesOnFor.id } : {}),
            ...(canMention && i === 0 && mentionIds(kind === 'text' ? text : caption, mentioned).length
              ? { mentions: mentionIds(kind === 'text' ? text : caption, mentioned) }
              : {}),
            ...(file && capture?.file !== file && meta?.capturedAt ? { taken_at: meta.capturedAt } : {}),
            ...(area && !noPlace ? { show_area: true } : {}),
            ...(placement === 'place' && !area
              ? {
                  pin: 'place' as const,
                  ...(venue.startsWith('osm:') ? { venue_id: venue } : venue ? { place_key: venue } : {}),
                }
              : {}),
            ...(later && p.share_later?.some((choice) => choice.key === later) ? { share_later: later } : {}),
            ...(height && canHeight && altitude != null
              ? {
                  altitude: {
                    meters: altitude,
                    accuracy_m: fromAlbum ? null : gps?.coords.altitudeAccuracy,
                    speed_mps: fromAlbum ? null : gps?.coords.speed,
                  },
                }
              : {}),
            ...(live &&
            capture &&
            Date.now() - capture.at <= 600000 &&
            gps &&
            capture.position &&
            distance(gps.coords, capture.position.coords) <= 150
              ? { taken_here: true, show_weather: weather }
              : {}),
            ...(count > 1 ? { series: { id: series, index: i + 1, count } } : {}),
            ...(deckOn && deckId.current ? { deck: { id: deckId.current, index: index + 1, count: files.length } } : {}),
            ...(toExplore ? { explore: true as const } : {}),
            ...(i === 0 && count === 1 && loopOut ? { loop: loopOut } : {}),
            ...wholeOut,
            ...(kept.length && i === 0
              ? { stamps: kept.map(({ kind, x, y, scale, rotation }) => ({ kind, ...frame.point(x, y), scale: frame.scale(scale), rotation })) }
              : {}),
            ...(playOut.length && i === 0 && !postKind
              ? { play: playWire(playOut).map((it) => placedPlay(it, frame)) }
              : {}),
            ...(canIlluminate && i === 0 && dotsWire(dots, { things: !isVideo && aiOn, links: !underPenName, whispers: canSound }).length
              ? {
                  dots: dotsWire(dots, { things: !isVideo && aiOn, links: !underPenName, whispers: canSound }).map((d) => ({
                    ...d,
                    ...frame.point(d.x as number, d.y as number),
                    ...(d.box ? { box: frame.box(d.box as { x: number; y: number; w: number; h: number }) } : {}),
                  })),
                }
              : {}),
            ...(i === 0 && kept.some((st) => st.kind === 'elevation') && altitude != null
              ? {
                  elevation: {
                    meters: altitude,
                    accuracy_m: fromAlbum ? null : gps?.coords.altitudeAccuracy,
                    speed_mps: fromAlbum ? null : gps?.coords.speed,
                  },
                }
              : {}),
          };
          return { body, media: prepared[i] };
        }),
      };
      try {
        await keepJob(job);
      } catch (e) {
        if (!(e instanceof DOMException)) throw e;
        job.memoryOnly = true;
        if (mounted.current) setError('Browser storage is full or unavailable. Keep this tab open until sharing finishes.');
      }
      made = job;
      if (mounted.current) setJobs((old) => [...old, job]);
      pendingSound.current = canSound
        ? {
            voice: voiceRec,
            words: voiceWords,
            place: placeRec,
            whispers: dots.filter((d) => d.kind === 'whisper' && d.audio).map((d) => ({ id: d.id, audio: d.audio! })),
          }
        : null;
      await deliver(job, controller.signal);
    } catch (e) {
      if (isSwitchedOff(e)) {
        if (made && !made.memoryOnly) await discardJob(made.id).catch(() => {});
        if (made && mounted.current) setJobs((old) => old.filter((j) => j.id !== made!.id));
        if (mounted.current) setWentOff(true);
      }
      else if (mounted.current) setError(messageOf(e, 'Couldn’t share. Try again.'));
    } finally {
      if (mounted.current) setBusy('');
      submitting.current = false;
      handle.current = null;
    }
  }
  // A Pulse post made in the Studio (CONTRACT 6d): today's request, as today's composer sends it, with the photo (the
  // picture as drawn, words and marks in it) uploaded after it as today's composer does, and the Studio's `studio`
  // field: where each stamp sits (the server fills the values) and the height reading for the elevation stamp.
  async function submitPost(postType: StudioKind) {
    if (submitting.current) return;
    submitting.current = true;
    const controller = new AbortController();
    handle.current = controller;
    setBusy('Preparing…');
    setError('');
    let posted = false;
    try {
      if (eyesOnOffered && eyesOn && !eyesOnPlaced) throw new Error('Pick the place you’re asking about.');
      let photo: File | null = null;
      if (file) {
        if (art.text.trim()) await fontReady(art.font, art.text);
        const source = canBlur && blurs.length ? await blurInto(lookFile ?? file, blurs) : lookFile ?? file;
        const [first] = isVideo
          ? await prepareMedia(source, art, limits.data?.video || fallback, controller.signal, () => {})
          : (await composed(source, controller.signal)).prepared;
        const prepared = await withAfter(first);
        photo = new File([prepared.file], 'studio.jpg', { type: prepared.file.type || 'image/jpeg' });
      }
      controller.signal.throwIfAborted();
      const at = placement === 'place' && pickedVenue ? { latitude: pickedVenue.center.lat, longitude: pickedVenue.center.lng } : point;
      const digits = phone.replace(/\D/g, '');
      postRequest.current ??= crypto.randomUUID();
      const body: Parameters<typeof postsApi.createPost>[0] & {
        studio: {
          stamps: PlacedStamp[];
          elevation?: { meters: number; accuracy_m?: number | null };
          explore?: boolean;
          eyes_on?: boolean;
          mentions?: string[];
          play?: Record<string, unknown>[];
          dots?: Record<string, unknown>[];
          taken_at?: string;
          taken_here?: boolean;
          fix?: { latitude: number; longitude: number; fix_at: string };
        };
      } = {
        clientRequestId: postRequest.current,
        content: words.trim(),
        postType,
        visibility: postPlaced ? 'neighborhood' : 'connections',
        audience: postPlaced ? 'nearby' : 'connections',
        postAs: underPenName ? 'pen_name' : 'personal',
        ...(postPlaced && at
          ? {
              latitude: at.latitude,
              longitude: at.longitude,
              ...(placeName ? { locationName: placeName } : {}),
              ...(placement === 'place' && venue.startsWith('osm:') ? { geocodePlaceId: venue } : {}),
              ...(fromAlbum
                ? { mediaLocations: [{ latitude: fromAlbum.latitude!, longitude: fromAlbum.longitude!, capturedAt: fromAlbum.capturedAt }] }
                : fix
                  ? {
                      gpsTimestamp: new Date(fix.timestamp).toISOString(),
                      gpsLatitude: fix.coords.latitude,
                      gpsLongitude: fix.coords.longitude,
                    }
                  : {}),
            }
          : {}),
        ...(postType === 'event'
          ? {
              eventDate: asStoredWallClock(eventStart),
              ...(eventEnd ? { eventEndDate: asStoredWallClock(eventEnd) } : {}),
              ...(eventVenue.trim() ? { eventVenue: eventVenue.trim() } : {}),
            }
          : {}),
        ...(postType === 'alert' ? { safetyAlertKind: alertKind as Parameters<typeof postsApi.createPost>[0]['safetyAlertKind'] } : {}),
        ...(postType === 'lost_found'
          ? { lostFoundType: lostType, contactPref: contact, ...(contact === 'phone' ? { contactPhone: digits } : {}) }
          : {}),
        purpose: purposeOf(postType),
        // Under a made-up name: no profile (today's composer leaves these out there).
        ...(underPenName ? {} : { profileVisibilityScope: 'local_context' as const, showOnProfile: true }),
        studio: {
          stamps: kept.map(({ kind: k, x, y, scale, rotation }) => ({ kind: k, ...frame.point(x, y), scale: frame.scale(scale), rotation })),
          // Playable items and dots on the post's photo (CONTRACT 7b, 7c: `studio.play`, `studio.dots`), placed as a Moment's.
          ...(photo && playOut.length ? { play: playWire(playOut).map((it) => placedPlay(it, frame)) } : {}),
          ...(photo && canIlluminate && dotsWire(dots, { things: aiOn, links: !underPenName }).length
            ? {
                dots: dotsWire(dots, { things: aiOn, links: !underPenName }).map((d) => ({
                  ...d,
                  ...frame.point(d.x as number, d.y as number),
                  ...(d.box ? { box: frame.box(d.box as { x: number; y: number; w: number; h: number }) } : {}),
                })),
              }
            : {}),
          ...(toExplore ? { explore: true } : {}),
          ...(eyesOnOffered && eyesOn ? { eyes_on: true } : {}),
          ...(canMention && mentionIds(words, mentioned).length ? { mentions: mentionIds(words, mentioned) } : {}),
          ...(kept.some((st) => st.kind === 'elevation') && altitude != null
            ? { elevation: { meters: altitude, accuracy_m: fromAlbum ? null : fix?.coords.altitudeAccuracy } }
            : {}),
          // When the picture was taken (CONTRACT 6d): a library photo's own time keeps "now" stamps off it; a shot the
          // camera took just now, with a fresh fix near the post's point, may keep weather and sunset. The server checks.
          ...(albumItem && meta?.capturedAt ? { taken_at: meta.capturedAt } : {}),
          ...(file && capture?.file === file && Date.now() - capture.at <= 600000 ? { taken_here: true } : {}),
          ...(fix && !albumItem
            ? { fix: { latitude: fix.coords.latitude, longitude: fix.coords.longitude, fix_at: new Date(fix.timestamp).toISOString() } }
            : {}),
        },
      };
      setBusy('Posting…');
      const res = await postsApi.createPost(await withFreshFix(body));
      const id = res.post?.id;
      if (typeof id !== 'string' || !id.trim()) throw new Error('Post could not be confirmed. Try again.');
      if (photo) {
        setBusy('Adding the photo…');
        const sent = await upload.uploadPostMedia(id, [photo]);
        if (!Array.isArray(sent?.media_urls) || !sent.media_urls.length)
          throw new Error('Post saved. The photo could not be confirmed. Try again.');
      }
      posted = true;
      postRequest.current = null;
      void client.invalidateQueries({ queryKey: ['posts', 'mine'], refetchType: 'none' });
      void client.invalidateQueries({ queryKey: ['feed'], refetchType: 'none' });
      void client.invalidateQueries({ queryKey: ['reinvented'] });
    } catch (e) {
      if (isSwitchedOff(e)) {
        postRequest.current = null;
        if (mounted.current) setWentOff(true);
      } else if (mounted.current) setError(messageOf(e, 'Couldn’t post. Try again.'));
    } finally {
      if (mounted.current) setBusy('');
      submitting.current = false;
      handle.current = null;
    }
    if (posted) onDone(`${kindName(postType)} posted to Pulse.`);
  }
  // Post: a setting that still needs the person opens the drawer at it, with the reason, instead of failing. The reason
  // stays only while it still holds (today's composer's words).
  const phoneDigits = phone.replace(/\D/g, '').length;
  const blocker =
    (postKind ? postPlaced : !noPlace) && !point
      ? 'Choose Use my location, or select No location.'
      : !postKind && noPlace && p?.has_connections === false
        ? 'A Moment without a location needs a connection.'
        : !postKind && homeWarning && !homeAck
          ? 'Confirm the pin at your home, or choose Show area.'
          : !postKind && caption.trim().length > 100
            ? 'A Moment’s caption is up to 100 characters.'
            : postKind && !words.trim()
              ? `Write what the ${kindName(postKind).toLowerCase()} is about.`
              : postKind === 'event'
                ? eventTimeError(eventStart, eventEnd) || ''
                : postKind === 'lost_found' && contact === 'phone' && (phoneDigits < 7 || phoneDigits > 15)
                  ? 'Enter a valid phone number.'
                  : '';
  function tryPost() {
    if (!blocker) return void (postKind ? submitPost(postKind) : submit());
    setError('');
    setAskedPost(true);
    setDrawerOpen(true);
    requestAnimationFrame(() => drawerRef.current?.focus({ preventScroll: true }));
  }
  function dismiss() {
    handle.current?.abort();
    onClose();
  }
  // Something would be lost by going back: a picture, words on it or a drawing, a caption, the words of a card.
  const unsaved = mode === 'media' ? !!file : mode === 'text' && (!!text.trim() || stamps.length > 0);
  function backToStart() {
    setRepliesShown(null);
    setDiscarding(false);
    setAskedPost(false);
    setTool(null);
    setTrayOpen(false);
    setStamps([]);
    setPicked(null);
    // Everything else placed on the discarded draft goes with it: its playable items, dots, blurs, sounds, loop, trim and
    // look (LEAD-7's look, 08:55: a discarded poll came back on the next photo).
    setPlay([]);
    setMaking(null);
    setPlayStart(null);
    setDots([]);
    setPickedDot(null);
    setIlluminate(false);
    setBlurs([]);
    setAfterBlurs([]);
    setAfterFile(null);
    setSide('before');
    setBlurOn(false);
    setSoundOpen(false);
    setVoiceRec(null);
    setVoiceWords('');
    setPlaceRec(null);
    setLoopSpan(null);
    setLoopOpen(false);
    setTrimSpan(null);
    setTrimOpen(false);
    setLook('original');
    setLookFile(null);
    setPicking(false);
    setMentioned([]);
    setGuessSpot(false);
    setKind(null);
    setKindMenu(false);
    setAskDeclined(false);
    setExploreOn(false);
    setDrawerOpen(false);
    setFiles([]);
    setSuggestDropped(false);
    setIndex(0);
    setCapture(null);
    setArt(blankArt());
    setStrokesBefore([]);
    setCaption('');
    setText('');
    setMode('none');
    setError('');
  }
  // The X: from a picture or words, back to the start (asking first when something would be lost); from the start,
  // out of the Studio. While posting it leaves as today's composer does: the upload stays in the outbox to resume.
  function closeOrBack() {
    if (busy || mode === 'none') dismiss();
    else if (unsaved) setDiscarding(true);
    else backToStart();
  }
  const trap = useDialogFocusTrap<HTMLDivElement>(() => {
    if (setupOpen) return;
    if (wentOff) return handBack();
    if (discarding) setDiscarding(false);
    else if (kindMenu) setKindMenu(false);
    else if (trayOpen) setTrayOpen(false);
    else if (picked) setPicked(null);
    else if (picking) setPicking(false);
    else if (tool) setTool(null);
    // The rail's own cards close before anything asks to discard (LEAD-7's look, 08:55: Escape in Sound and Blur asked to
    // discard instead).
    else if (blurOn) setBlurOn(false);
    else if (soundOpen) setSoundOpen(false);
    else if (loopOpen) setLoopOpen(false);
    else if (trimOpen) setTrimOpen(false);
    else if (pickedDot) setPickedDot(null);
    else if (illuminate) setIlluminate(false);
    else if (drawerOpen && !wide) setDrawerOpen(false);
    else if (camera) setCamera(false);
    else closeOrBack();
  });
  // A trackpad's pinch (ctrl and the wheel) never zooms the page anywhere in the Studio: over the picture it sizes the
  // picture (StudioPicture), elsewhere it does nothing (LEAD-8's look, 09:36: over the rail, the chips, the caption and the
  // location bar it would still have zoomed the page).
  useEffect(() => {
    const root = trap.current;
    if (!root) return undefined;
    const pinch = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    root.addEventListener('wheel', pinch, { passive: false });
    return () => root.removeEventListener('wheel', pinch);
  }, [trap, wide]);
  // On a wide screen the details sit beside the picture but come after Post in the page: Tab runs the rail, the picture's
  // controls, the details and then Post, and Shift+Tab the other way (LEAD-8's look, 09:36: Tab reached Post first).
  useEffect(() => {
    const root = trap.current;
    if (!wide || !root) return undefined;
    const focusable =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const shown = (el: HTMLElement) =>
      el.getAttribute('type') !== 'hidden' &&
      el.getClientRects().length > 0 &&
      !el.closest('[hidden], [inert]') &&
      getComputedStyle(el).visibility !== 'hidden';
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
      const at = document.activeElement as HTMLElement | null;
      // A question or menu opened over the Studio keeps its own Tab.
      if (!at || at.closest('[aria-modal="true"]') !== root) return;
      const post = root.querySelector<HTMLElement>('[data-studio-post]'),
        details = root.querySelector<HTMLElement>('.st-drawer');
      if (!post || !details || !shown(post)) return;
      const all = [...root.querySelectorAll<HTMLElement>(focusable)].filter(shown);
      const inside = all.filter((el) => details.contains(el)),
        rest = all.filter((el) => !details.contains(el));
      const p = rest.indexOf(post);
      if (p < 0 || !inside.length) return;
      const order = [...rest.slice(0, p), ...inside, ...rest.slice(p)];
      const i = order.indexOf(at);
      if (i < 0) return;
      e.preventDefault();
      e.stopPropagation();
      order[(i + (e.shiftKey ? -1 : 1) + order.length) % order.length].focus();
    };
    root.addEventListener('keydown', key, true);
    return () => root.removeEventListener('keydown', key, true);
  }, [trap, wide]);

  const placeName =
    placement === 'place'
      ? (venue && (p?.places.find((v) => v.key === venue)?.label || nearby.find((v) => v.place_id === venue)?.name)) ||
        p?.place?.label
      : area || underPenName
        ? p?.area?.label || p?.area_label
        : p?.place_label;
  // The pill's place line (lead, 2026-11-27 00:40): an exact pin on the home reads "Your home", with today's warning
  // under it every time; the area reads "Area · <town>".
  const placeLine = noPlace
    ? 'No location · friends only'
    : !point
      ? 'Choose your location'
      : homeWarning
        ? 'Your home'
        : (area || (underPenName && placement !== 'place')
            ? 'Area · '
            : // Under a made-up name, pinned at the place the author picked (founder 2026-11-27, via the lead).
              underPenName
              ? 'At '
              : '') + (placeName || (preview.isPending ? 'Finding place…' : 'Selected location'));
  const laterChoice = later ? p?.share_later?.find((v) => v.key === later) : undefined;
  // With Share later the pill reads "Shares at 6:40 pm" over "24 hours · <place>".
  const pillPlace = postKind
    ? postPlaced
      ? placeLine
      : 'Your connections · no place'
    : laterChoice
      ? `${hours} ${hours === 1 ? 'hour' : 'hours'} · ${placeLine}`
      : placeLine;
  // A post made here says how long it stays instead (CONTRACT 6d): "Stays until answered", "Stays in Atlas", "Until
  // claimed", "Until Saturday 11 am".
  const timeLine = postKind
    ? kindPill(postKind, eventEnd || eventStart, new Date(now))
    : laterChoice
    ? 'Shares at ' +
      new Date(laterChoice.at)
        .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        .replace(/\s?AM$/, ' am')
        .replace(/\s?PM$/, ' pm')
    : `Fades in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const who = underPenName ? 'pen' : noPlace || audience === 'connections' ? 'friends' : 'nearby';
  // The details in one line (PHASE-5 A4), e.g. "Fallen Leaf Lake Park · Fades in 24 hours · Everyone nearby".
  // Without a place the place line already says "friends only", so who sees it isn't said twice.
  const summary = [
    pillPlace,
    timeLine,
    who === 'pen' ? (penMe?.pen_name?.name ? `As ${penMe.pen_name.name}` : 'Made-up name') : noPlace ? '' : who === 'friends' ? 'Friends' : 'Everyone nearby',
  ]
    .filter(Boolean)
    .join(' · ');
  const content = mode === 'text' ? !!text.trim() : !!file;
  const ready = recovered && !busy && !reading && attested && !!p && content;
  const gate = jobs.length > 0 || !attested;
  const composing = !gate && !camera && mode !== 'none';
  // The picture fills the frame (Fill) or not, and whether it already does when whole (a 9:16 picture): PHASE-5 A2.
  // Both at the angle it is turned to (any angle: whole.ts).
  const fitAt = (turn: number) => (shape ? fitZoom(shape.w, shape.h, turn) : 1),
    fillAt = (turn: number) => (shape ? fillZoom(shape.w, shape.h, turn) : 1);
  const centred = !art.offset.x && !art.offset.y;
  const fillsAlready = !!shape && Math.abs(fillAt(art.rotation) - fitAt(art.rotation)) < 0.005;
  const filled = !!shape && !fillsAlready && centred && Math.abs(art.zoom - fillAt(art.rotation)) < 0.005;
  const fitted = centred && Math.abs(art.zoom - fitAt(art.rotation)) < 0.005;
  // A quarter turn keeps a picture that was whole whole, and one that filled the frame filling it.
  function turnQuarter() {
    const rotation = stuckTurn(art.rotation + 90);
    setArt({ ...art, rotation, zoom: filled ? fillAt(rotation) : fitted ? fitAt(rotation) : art.zoom });
  }
  const sizes = shape ? zoomRange(shape.w, shape.h) : { min: 0.5, max: 3 };

  const settings = (
    <section
      className="st-drawer"
      ref={drawerRef}
      tabIndex={-1}
      aria-label="Post settings"
      data-wide={wide || undefined}
    >
      <header className={wide ? undefined : 'st-drawer-head'} {...(wide ? {} : dragClose)}>
        {!wide && <span className="st-grabber" aria-hidden="true" />}
        <h2>Post settings</h2>
        {!wide && (
          <button type="button" className="st-done" onClick={() => setDrawerOpen(false)}>
            Done
          </button>
        )}
      </header>
      <fieldset disabled={!!busy}>
        {/* Who sees it, first in the drawer: the bar holds only the one line that sums the details up (PHASE-5 A4). */}
        <div className="st-group" role="group" aria-label="Who sees it">
          <span className="st-label">
            <Users size={15} aria-hidden="true" />
            Who sees it
          </span>
          <div className="st-who">
            <Chip on={who === 'nearby'} disabled={noPlace || !!busy} onClick={() => pickWho('nearby')}>
              Nearby
            </Chip>
            <Chip on={who === 'friends'} disabled={!!busy} onClick={() => pickWho('friends')}>
              Friends
            </Chip>
            {penMe && (
              <Chip on={who === 'pen'} disabled={!!busy} onClick={() => pickWho('pen')}>
                Made-up name
              </Chip>
            )}
          </div>
        </div>
        {postKind && (
          <div className="st-group st-kind-group" role="group" aria-label={kindName(postKind)}>
            <span className="st-label">
              <MessageCircleQuestion size={15} aria-hidden="true" />
              {kindName(postKind)}
            </span>
            {postKind === 'alert' && (
              <>
                <div className="st-chips">
                  {ALERT_KINDS.map(([k, label]) => (
                    <Chip key={k} on={alertKind === k} onClick={() => setAlertKind(k)}>
                      {label}
                    </Chip>
                  ))}
                </div>
                <p className="st-note">Heads-ups can’t be about crime or suspicious people. In an emergency, call 911.</p>
              </>
            )}
            {postKind === 'lost_found' && (
              <>
                <div className="st-chips">
                  <Chip on={lostType === 'lost'} onClick={() => setLostType('lost')}>
                    Lost
                  </Chip>
                  <Chip on={lostType === 'found'} onClick={() => setLostType('found')}>
                    Found
                  </Chip>
                </div>
                <span className="st-label">How should people contact you?</span>
                <div className="st-chips">
                  {CONTACT_CHOICES.map(([k, label]) => (
                    <Chip key={k} on={contact === k} onClick={() => setContact(k)}>
                      {label}
                    </Chip>
                  ))}
                </div>
                {contact === 'phone' && (
                  <label className="st-field">
                    Phone
                    <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </label>
                )}
              </>
            )}
            {postKind === 'event' && (
              <>
                <label className="st-field">
                  Starts
                  <input type="datetime-local" value={eventStart} onChange={(e) => setEventStart(e.target.value)} />
                </label>
                <label className="st-field">
                  Ends (optional)
                  <input type="datetime-local" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} />
                </label>
                <label className="st-field">
                  Venue (optional)
                  <input value={eventVenue} maxLength={200} onChange={(e) => setEventVenue(e.target.value)} placeholder="Where it is" />
                </label>
              </>
            )}
            {(postKind === 'ask_local' || postKind === 'recommendation' || postKind === 'local_update') && (
              <p className="st-note">{kindHint(postKind)}.</p>
            )}
          </div>
        )}
        <div className="st-group" role="group" aria-label="Where it shows">
          <span className="st-label">
            <MapPin size={15} aria-hidden="true" />
            Where it shows
          </span>
          <div className="st-chips">
            <Chip
              on={placement === 'exact'}
              onClick={() => {
                setPlacement('exact');
                setVenue('');
                setHomeAck(false);
              }}
            >
              {p?.at_home && p.sky ? 'Area around home' : fromAlbum ? 'Where this was taken' : 'Where I am'}
            </Chip>
            <Chip
              on={placement === 'area'}
              onClick={() => {
                setPlacement('area');
                setVenue('');
                setHomeAck(false);
              }}
            >
              Show the area
            </Chip>
            {p && !p.at_home && (p.can_pin || p.places?.some((v) => v.key.startsWith('v_'))) && (
              <Chip
                on={placement === 'place'}
                onClick={() => {
                  setPlacement('place');
                  setVenue('');
                  setHomeAck(false);
                }}
              >
                Pin it at a place
              </Chip>
            )}
            {!underPenName && (
              <Chip
                on={placement === 'none'}
                onClick={() => {
                  setPlacement('none');
                  setVenue('');
                  setHomeAck(false);
                }}
              >
                No location
              </Chip>
            )}
          </div>
          {!noPlace && (
            <div className="st-where">
              <div>
                <strong>{postKind && !postPlaced ? 'Your connections' : placeLine}</strong>
                <small>
                  {postKind && !postPlaced
                    ? 'A post to your connections shows no place.'
                    : underPenName
                    ? 'Under a made-up name it shows over its area, or at a public place, to people nearby.'
                    : area
                      ? 'Only the area is shown.'
                      : point
                        ? 'A pin appears at this location.'
                        : 'Allow a location fix to place your Moment on the map.'}
                </small>
              </div>
              {!fromAlbum && (
                <button
                  type="button"
                  aria-label="Use my location"
                  title="Use my location"
                  disabled={locating}
                  onClick={() => void locate()}
                >
                  <LocateFixed size={19} />
                </button>
              )}
            </div>
          )}
          {!noPlace && locError && <small role="status">{locError}</small>}
          {point && p && shownPoint && (
            <div className="st-map">
              <PlacePreview point={shownPoint} radius={area ? p.area?.radius_m : undefined} />
            </div>
          )}
          {noPlace && (
            <p className="st-note">
              {p?.has_connections === false
                ? 'Add a connection to share without a location.'
                : 'Only your friends see it. It won’t appear on the map.'}
            </p>
          )}
          {placement === 'place' && (
            <>
              <label className="st-field">
                Place nearby
                <input value={venueTerm} onChange={(e) => setVenueTerm(e.target.value)} placeholder="Search places nearby" />
              </label>
              <select aria-label="Pin location" value={venue} onChange={(e) => setVenue(e.target.value)}>
                <option value="">{p?.place?.label || 'Suggested place'}</option>
                {p?.places
                  .filter((v) => v.key.startsWith('v_'))
                  .map((v) => (
                    <option key={v.key} value={v.key}>
                      {v.label}
                    </option>
                  ))}
                {nearby.map((v) => (
                  <option key={v.place_id} value={v.place_id!}>
                    {v.name}
                  </option>
                ))}
              </select>
              {venues.data?.attribution && <small>{venues.data.attribution}</small>}
            </>
          )}
          {!postKind && homeWarning && (
            <label className="st-check">
              <input type="checkbox" checked={homeAck} onChange={(e) => setHomeAck(e.target.checked)} />
              This is my home. People will see the pin on it.
            </label>
          )}
          {!postKind && canHeight && (
            <label className="st-check">
              <input type="checkbox" checked={height} onChange={(e) => setHeight(e.target.checked)} />
              Show height
            </label>
          )}
          {!postKind && live && (
            <div className="st-note">
              Live from here
              {p?.weather && (
                <label className="st-check">
                  <input type="checkbox" checked={weather} onChange={(e) => setWeather(e.target.checked)} />
                  Show weather · {p.weather.temp_f}°F
                </label>
              )}
            </div>
          )}
        </div>
        {exploreOffered && (
          <div className="st-group" role="group" aria-label="Explore">
            <label className="st-check">
              <input type="checkbox" checked={exploreOn} onChange={(e) => setExploreOn(e.target.checked)} />
              Also show in Explore
            </label>
            <p className="st-note">People anywhere can see this, with its place.</p>
          </div>
        )}
        {!postKind && !underPenName && (
          <div className="st-group" role="group" aria-label="Replies">
            <label className="st-check">
              <input
                type="checkbox"
                checked={repliesShown ?? (noPlace || audience === 'connections')}
                onChange={(e) => setRepliesShown(e.target.checked)}
              />
              Replies everyone can see
            </label>
            <p className="st-note">
              {repliesShown ?? (noPlace || audience === 'connections')
                ? 'People who see this Moment can read and add replies under it. You can hide them later.'
                : 'Replies come to you privately, in your messages.'}
            </p>
          </div>
        )}
        {eyesOnOffered && (
          <div className="st-group" role="group" aria-label="Eyes on">
            <label className="st-check">
              <input type="checkbox" checked={eyesOn} onChange={(e) => setEyesOn(e.target.checked)} />
              Eyes on: ask people who are there now
            </label>
            <p className="st-note">
              {eyesOn && !eyesOnPlaced
                ? 'Pick the place you’re asking about: choose “Pin it at a place” above.'
                : 'For six hours, people at this place can answer with a Live photo. Nobody is told who is near it.'}
            </p>
          </div>
        )}
        {boardOffered && (
          <div className="st-group" role="group" aria-label="Pinboard">
            <label className="st-check">
              <input type="checkbox" checked={startBoard} onChange={(e) => setStartBoard(e.target.checked)} />
              Start a pinboard
            </label>
            <p className="st-note">A prompt others add their own photo to for a week, one each. It stays.</p>
            {startBoard && (
              <input
                className="st-retake-title"
                value={boardPrompt}
                maxLength={80}
                onChange={(e) => setBoardPrompt(e.target.value)}
                placeholder="Best fall tree on your walk"
                aria-label="The pinboard’s prompt"
              />
            )}
          </div>
        )}
        {skyOffered && (
          <div className="st-group" role="group" aria-label="Tonight's sky">
            <label className="st-check">
              <input type="checkbox" checked={joinSky} onChange={(e) => setJoinSky(e.target.checked)} />
              Join tonight’s sky: your photo stays in the piece
            </label>
            <p className="st-note">Only if several people photograph a real sunset or a first snow here in the same minutes.</p>
          </div>
        )}
        {sealOffered && (
          <div className="st-group" role="group" aria-label="Seal it">
            <span className="st-label">Seal it: it opens later</span>
            <div className="st-chips">
              {(
                [
                  ['none', 'Not sealed'],
                  ['date', 'On a date'],
                  ['place', 'When someone stands here'],
                  ['rain', 'The next time it rains here'],
                ] as const
              ).map(([v, label]) => (
                <Chip key={v} on={sealWhen === v} disabled={(v === 'place' || v === 'rain') && !sealPlaceOk} onClick={() => setSealWhen(v)}>
                  {label}
                </Chip>
              ))}
            </div>
            {sealWhen === 'date' && (
              <input
                className="st-retake-title"
                type="datetime-local"
                value={sealAt}
                min={new Date(Date.now() + 3_600_000 - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)}
                onChange={(e) => setSealAt(e.target.value)}
                aria-label="When it opens"
              />
            )}
            <p className="st-note">
              {sealWhen === 'none'
                ? 'Until it opens, only you see what it holds.'
                : (sealWhen === 'place' || sealWhen === 'rain') && !sealPlaceOk
                  ? 'This needs its exact place, on a photo or words.'
                  : 'Until it opens, only you see what it holds. It stays, so it’s there when it opens.'}
            </p>
          </div>
        )}
        {retakeOffered && (
          <div className="st-group" role="group" aria-label="Retake">
            <label className="st-check">
              <input type="checkbox" checked={startRetake} onChange={(e) => setStartRetake(e.target.checked)} />
              Start a Retake
            </label>
            <p className="st-note">A Retake shows this exact spot and stays, so others can stand here.</p>
            {startRetake && (
              <input
                className="st-retake-title"
                value={retakeTitle}
                maxLength={60}
                onChange={(e) => setRetakeTitle(e.target.value)}
                placeholder="Its name, like The cedar bench"
                aria-label="The Retake’s name"
              />
            )}
          </div>
        )}
        {deckOffered && (
          <div className="st-group" role="group" aria-label="Steps">
            <label className="st-check">
              <input
                ref={deckBox}
                type="checkbox"
                checked={asDeck}
                disabled={index > 0 || !!busy}
                onChange={(e) => chooseDeck(e.target.checked)}
              />
              Post these {files.length} as steps
            </label>
            <p className="st-note">
              {index > 0
                ? asDeck
                  ? `Step ${index + 1} of ${files.length}. Give it its own words and voice tip.`
                  : 'Posted one by one.'
                : 'A recipe or a repair: readers go through the steps as one, each with its own words and voice tip.'}
            </p>
            {deckOn && deckNote && <p className="st-note">Readers can save your steps’ words.</p>}
          </div>
        )}
        {!postKind && (
        <div className="st-group" role="group" aria-label="How long">
          <span className="st-label">
            <Clock3 size={15} aria-hidden="true" />
            How long
          </span>
          <div className="st-chips">
            {([1, 6, 24, 48] as const).map((h) => (
              <Chip key={h} on={hours === h} onClick={() => setHours(h)}>
                {h} {h === 1 ? 'hour' : 'hours'}
              </Chip>
            ))}
          </div>
        </div>
        )}
        {!postKind && !!p?.share_later?.length && (
          <div className="st-group" role="group" aria-label="When it shares">
            <span className="st-label">When it shares</span>
            <div className="st-chips">
              <Chip on={!later} onClick={() => setLater('')}>
                Now
              </Chip>
              {p.share_later.map((v) => (
                <Chip key={v.key} on={later === v.key} onClick={() => setLater(v.key)}>
                  {v.label} · {new Date(v.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </fieldset>
      {preview.isError && (
        <button type="button" className="st-linkish" onClick={() => void preview.refetch()}>
          Retry post settings
        </button>
      )}
    </section>
  );

  const stage = (
    <div
      ref={trap}
      className="st-studio"
      role="dialog"
      aria-modal="true"
      aria-label="Create Moment"
      data-wide={wide || undefined}
      data-drawer={(drawer && composing) || undefined}
      onPointerDownCapture={onItemPress}
    >
      <div className="st-stage">
        <div
          className="st-frame"
          data-tool={tool || undefined}
          data-picking={picking || undefined}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy && !gate) choose([...e.dataTransfer.files]);
          }}
        >
          <div
            className="st-art"
            style={mode === 'text' && !camera && !gate ? { background: colors[bg] } : undefined}
            onPointerDownCapture={(e) => {
              if (picked && !(e.target as HTMLElement).closest('.sp-stamp')) setPicked(null);
            }}
          >
            {camera ? (
              <MomentCamera
                maxSeconds={(limits.data?.video.max_seconds || 30) * (limits.data?.video.max_parts || 1)}
                onClose={() => setCamera(false)}
                onCapture={(c) => {
                  choose([c.file]);
                  setCapture(c);
                  if (c.position) setFix(c.position);
                  setCamera(false);
                }}
              />
            ) : gate ? null : mode === 'media' && file ? (
              <StudioPicture
                file={showAfter ? afterFile! : lookFile ?? file}
                backdrop={backdrop}
                art={art}
                onChange={setArt}
                tool={tool}
                ink={ink}
                pen={pen}
                brush={brush}
                picking={picking}
                onPick={(c) => {
                  if (tool === 'draw') setInk(c);
                  else setArt({ ...art, color: c });
                  setPicking(false);
                }}
                onBeforeStrokes={(before) => setStrokesBefore((list) => [...list.slice(-49), before])}
                onPicture={
                  showAfter
                    ? undefined
                    : (el, w, h) => {
                        setPhotoInks(sampleColors(el, w, h, inks));
                        setShape({ w, h });
                        setBackdrop(backdropOf(el));
                        setVideoMs(el instanceof HTMLVideoElement && Number.isFinite(el.duration) ? Math.round(el.duration * 1000) : null);
                      }
                }
                loop={loopOut ?? trimOut}
              />
            ) : mode === 'text' ? (
              <div className="st-words">
                <textarea
                  ref={wordsRef}
                  aria-label="Your words"
                  maxLength={200}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    followCaret('words', e.target);
                  }}
                  onSelect={(e) => followCaret('words', e.currentTarget)}
                  onBlur={() => setTimeout(() => setCaretAt((c) => (c?.field === 'words' ? null : c)), 150)}
                  placeholder="What’s happening here?"
                />
                <small>{text.length}/200</small>
                {caretAt?.field === 'words' && (
                  <MentionPicker text={text} caret={caretAt.at} picked={mentioned} enabled={canMention} onPick={(n) => pickMention('words', n)} />
                )}
              </div>
            ) : null}
            {retakeOf?.ghost && ghostOn && (
              // eslint-disable-next-line @next/next/no-img-element -- the Retake's first picture, to line up with
              <img className="st-ghost" src={retakeOf.ghost} alt="" aria-hidden="true" />
            )}
            {composing && kept.length > 0 && (
              <StampLayer
                stamps={kept}
                valueOf={stampValue}
                ink={stampInk}
                selected={picked}
                onSelect={setPicked}
                onChange={tool || busy ? undefined : setStamps}
              />
            )}
            {composing && playOn && <PlayEditLayer items={play} onChange={setPlay} disabled={!!tool || !!busy} />}
            {composing && canBlur && (
              <BlurLayer boxes={showAfter ? afterBlurs : blurs} active={blurOn && !busy} onChange={showAfter ? setAfterBlurs : setBlurs} />
            )}
            {composing && canIlluminate && (
              <DotEditLayer
                dots={dots}
                active={illuminate && !busy}
                selected={illuminate ? pickedDot : null}
                onAdd={(x, y) => {
                  if (dots.length >= MAX_DOTS) return;
                  const d = newDot(dots, x, y);
                  setDots([...dots, d]);
                  setPickedDot(d.id);
                }}
                onSelect={(id) => {
                  setIlluminate(true);
                  setTool(null);
                  setPickedDot(id);
                }}
                onMove={tool || busy ? undefined : (id, x, y) => setDots((all) => all.map((d) => (d.id === id ? { ...d, x, y } : d)))}
              />
            )}
          </div>
          {!camera && <div className="st-shade-top" aria-hidden="true" />}
          {!camera && <div className="st-shade-bottom" aria-hidden="true" />}

          {!camera && (
            <div className="st-top">
              {pinboardOf && <span className="st-retake-banner">Adding your piece to “{pinboardOf.prompt}”</span>}
              {eyesOnFor && (
                <span className="st-retake-banner">Answering “{eyesOnFor.question}” with a Live photo</span>
              )}
              {retakeOf && (
                <button type="button" className="st-retake-banner" aria-pressed={ghostOn} onClick={() => setGhostOn(!ghostOn)}>
                  Adding to “{retakeOf.title}” · {ghostOn ? 'Hide the first picture' : 'Show the first picture'}
                </button>
              )}
              <button
                type="button"
                className="st-round"
                aria-label={mode === 'none' ? 'Close without posting' : 'Back to the camera'}
                onClick={closeOrBack}
              >
                <X size={20} strokeWidth={2.4} />
              </button>
              {composing && files.length > 1 && file && (
                <span className="st-count">
                  {canBrowse && nextUnposted(-1) >= 0 && (
                    <button type="button" className="st-browse" aria-label="The picture before" onClick={() => browse(-1)}>
                      <ChevronLeft size={16} aria-hidden="true" />
                    </button>
                  )}
                  {deckOn ? `Step ${index + 1} of ${files.length}` : `${index + 1} of ${files.length}`}
                  {canBrowse && nextUnposted(1) >= 0 && (
                    <button type="button" className="st-browse" aria-label="The next picture" onClick={() => browse(1)}>
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  )}
                </span>
              )}
              {composing && pair && (
                <div className="st-ba-switch" role="group" aria-label="Which photo the Studio shows">
                  <button type="button" aria-pressed={side === 'before'} onClick={() => setSide('before')}>
                    {pairItem?.before || 'Before'}
                  </button>
                  <button type="button" aria-pressed={side === 'after'} onClick={() => setSide('after')}>
                    {pairItem?.after || 'After'}
                  </button>
                </div>
              )}
            </div>
          )}

          {composing && (mode === 'text' || !!file) && (
            <div className="st-rail" role="toolbar" aria-label="Tools" aria-orientation="vertical">
              {mode === 'media' && (
                <div className="st-tool">
                  <span aria-hidden="true">Text</span>
                  <button
                    type="button"
                    className="st-round st-aa"
                    aria-label="Text"
                    aria-pressed={tool === 'text'}
                    onClick={() => setTool(tool === 'text' ? null : 'text')}
                  >
                    Aa
                  </button>
                </div>
              )}
              <div className="st-tool">
                <span aria-hidden="true">Stamps and Play</span>
                <button
                  type="button"
                  className="st-round"
                  aria-label="Stamps and Play"
                  aria-pressed={trayOpen}
                  disabled={!!busy}
                  onClick={() => {
                    setTool(null);
                    setTrayOpen(!trayOpen);
                  }}
                >
                  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 5h14v9l-5 5H5z" />
                    <path d="M14 19v-5h5" />
                  </svg>
                </button>
              </div>
              {mode === 'media' && (
                <>
              <div className="st-tool">
                <span aria-hidden="true">Draw</span>
                <button
                  type="button"
                  className="st-round"
                  aria-label="Draw"
                  aria-pressed={tool === 'draw'}
                  onClick={() => setTool(tool === 'draw' ? null : 'draw')}
                >
                  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 17c3-7 5 3 8-3s4-9 10-6" />
                  </svg>
                </button>
              </div>
              <div className="st-tool">
                <span aria-hidden="true">Resize</span>
                <button
                  type="button"
                  className="st-round"
                  aria-label="Resize"
                  aria-pressed={tool === 'resize'}
                  onClick={() => setTool(tool === 'resize' ? null : 'resize')}
                >
                  <Crop size={20} aria-hidden="true" />
                </button>
              </div>
              {canLoop && (
                <div className="st-tool">
                  <span aria-hidden="true">{loopOut ? 'Loop on' : 'Loop'}</span>
                  <button
                    type="button"
                    className="st-round"
                    aria-label={loopOut ? 'Loop, on' : 'Loop'}
                    aria-pressed={loopOpen}
                    onClick={() => {
                      setTool(null);
                      setIlluminate(false);
                      setSoundOpen(false);
                      setTrayOpen(false);
                      setTrimOpen(false);
                      setLoopOpen(!loopOpen);
                    }}
                  >
                    <Repeat size={20} aria-hidden="true" />
                  </button>
                </div>
              )}
              {canIlluminate && (
                <div className="st-tool">
                  <span aria-hidden="true">Illuminate</span>
                  <button
                    type="button"
                    className="st-round"
                    aria-label="Illuminate"
                    aria-pressed={illuminate}
                    onClick={() => {
                      setTool(null);
                      setPickedDot(null);
                      setIlluminate(!illuminate);
                    }}
                  >
                    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
                    </svg>
                  </button>
                </div>
              )}
              {canSound && (
                <div className="st-tool">
                  <span aria-hidden="true">Sound</span>
                  <button
                    type="button"
                    className="st-round"
                    aria-label="Sound"
                    aria-pressed={soundOpen}
                    onClick={() => {
                      setTool(null);
                      setIlluminate(false);
                      setSoundOpen(!soundOpen);
                    }}
                  >
                    <Mic size={20} aria-hidden="true" />
                  </button>
                </div>
              )}
              {canBlur && (
                <div className="st-tool">
                  <span aria-hidden="true">Blur</span>
                  <button
                    type="button"
                    className="st-round"
                    aria-label="Blur"
                    aria-pressed={blurOn}
                    onClick={() => {
                      setTool(null);
                      setIlluminate(false);
                      setSoundOpen(false);
                      setBlurOn(!blurOn);
                    }}
                  >
                    <EyeOff size={20} aria-hidden="true" />
                  </button>
                </div>
              )}
                </>
              )}
            </div>
          )}

          {composing && canBlur && blurOn && !tool && (
            <div className="st-toolpanel" role="group" aria-label="Blur">
              <p className="st-hint">
                Drag over faces of people who didn’t ask to be in it, licence plates, house numbers and mail labels. They’re blurred into the photo when you post.
              </p>
              <div className="dt-row">
                {blurs.length > 0 && (
                  <button type="button" className="st-chip" onClick={() => setBlurs([])}>
                    Take all off
                  </button>
                )}
                <button type="button" className="st-done" onClick={() => setBlurOn(false)}>
                  Done
                </button>
              </div>
            </div>
          )}
          {composing && canSound && soundOpen && !tool && !illuminate && (
            <SoundPanel
              voice={voiceRec}
              setVoice={setVoiceRec}
              words={voiceWords}
              setWords={setVoiceWords}
              place={placeRec}
              setPlace={setPlaceRec}
              onDone={() => setSoundOpen(false)}
            />
          )}
          {composing && canTrim && trimOpen && !tool && !illuminate && !soundOpen && (
            <TrimPanel
              durationMs={videoMs}
              span={trimOut}
              onSpan={(next) => setTrimSpan(heldTrim(next, videoMs) ?? null)}
              onOff={() => {
                setTrimSpan(null);
                setTrimOpen(false);
              }}
              onDone={() => setTrimOpen(false)}
            />
          )}
          {composing && canLoop && loopOpen && !tool && !illuminate && !soundOpen && (
            <LoopPanel
              durationMs={videoMs}
              maxSeconds={loopMax}
              span={loopOut}
              onSpan={setLoopSpan}
              onOff={() => {
                setLoopSpan(null);
                setLoopOpen(false);
              }}
              onDone={() => setLoopOpen(false)}
            />
          )}
          {composing && canIlluminate && illuminate && !tool && (
            <DotEditPanel
              dot={dots.find((d) => d.id === pickedDot) || null}
              count={dots.length}
              allowLink={!underPenName}
              allowThing={!isVideo && aiOn}
              allowWhisper={canSound}
              onChange={(d) => setDots(dots.map((x) => (x.id === d.id ? d : x)))}
              onRemove={(id) => {
                setDots(dots.filter((x) => x.id !== id));
                setPickedDot(null);
              }}
              onDone={() => {
                setIlluminate(false);
                setPickedDot(null);
              }}
            />
          )}
          {composing && tool && (
            <div
              className="st-toolpanel"
              role="group"
              aria-label={tool === 'text' ? 'Words on the picture' : tool === 'draw' ? 'Draw' : 'Resize'}
            >
              {tool === 'resize' && (
                <>
                  <small className="st-hint">Drag the picture to move it. Two fingers, or Shift and the wheel, turn it.</small>
                  <div className="st-picture-row">
                    <label className="st-field">
                      Zoom
                      <input
                        type="range"
                        min={sizes.min}
                        max={sizes.max}
                        step=".01"
                        value={Math.min(sizes.max, Math.max(sizes.min, art.zoom))}
                        onChange={(e) => setArt({ ...art, zoom: Number(e.target.value) })}
                      />
                    </label>
                    {/* Any angle (PHASE-5 A2), sticking at quarter turns as the phones' Resize does. */}
                    <label className="st-field">
                      Angle {Math.round(turnOf(art.rotation))}°
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={turnOf(art.rotation)}
                        onChange={(e) => {
                          // A keyboard's one-degree step is kept as it is (it snapped back to 0: LEAD-7's look, 08:55);
                          // a pointer's jump still sticks at quarter turns.
                          const v = Number(e.target.value);
                          setArt({ ...art, rotation: Math.abs(v - turnOf(art.rotation)) <= 1 ? v : stuckTurn(v) });
                        }}
                      />
                    </label>
                    <button type="button" className="st-chip" onClick={turnQuarter}>
                      <RotateCw size={15} aria-hidden="true" />
                      Turn
                    </button>
                  </div>
                </>
              )}
              {tool === 'text' && (
                <>
                  <input
                    ref={textInput}
                    aria-label="Words on the picture"
                    placeholder="Write on the picture"
                    maxLength={120}
                    value={art.text}
                    style={
                      art.font
                        ? { fontFamily: art.font.family, fontWeight: art.font.weight, fontStyle: art.font.style }
                        : undefined
                    }
                    onChange={(e) => setArt({ ...art, text: e.target.value })}
                  />
                  <div className="st-looks" role="group" aria-label="Font">
                    {TEXT_LOOKS.map((look) => (
                      <button
                        type="button"
                        key={look.name}
                        aria-pressed={(art.font?.family || '') === (look.font?.family || '')}
                        style={
                          look.font
                            ? { fontFamily: look.font.family, fontWeight: look.font.weight, fontStyle: look.font.style }
                            : undefined
                        }
                        onClick={() => void pickLook(look)}
                      >
                        {look.name}
                      </button>
                    ))}
                  </div>
                  <label className="st-field">
                    Size
                    <input
                      type="range"
                      min=".04"
                      max=".15"
                      step=".005"
                      value={art.size}
                      onChange={(e) => setArt({ ...art, size: Number(e.target.value) })}
                    />
                  </label>
                  {/* Moving words (CONTRACT 7k): the author's words over a photo, moving; never drawn into it. */}
                  {playOn && canBlur && (
                    <button
                      type="button"
                      className="st-chip"
                      disabled={play.length >= MAX_PLAY || play.filter((p) => p.kind === 'moving_words').length >= 2}
                      onClick={() => {
                        setTool(null);
                        setMaking('moving_words');
                        setTrayOpen(true);
                      }}
                    >
                      Moving words
                    </button>
                  )}
                </>
              )}
              {tool !== 'resize' && (
              <div className="st-inks">
                {inks.map((v, i) => (
                  <button
                    type="button"
                    key={v}
                    aria-label={inkNames[i]}
                    style={{ background: v }}
                    aria-pressed={v === (tool === 'draw' ? ink : art.color)}
                    onClick={() => (tool === 'draw' ? setInk(v) : setArt({ ...art, color: v }))}
                  />
                ))}
                {photoInks.length > 0 && <span className="st-inks-from">From your photo</span>}
                {photoInks.map((v, i) => (
                  <button
                    type="button"
                    key={'photo-' + v}
                    aria-label={`Colour ${i + 1} from your photo`}
                    style={{ background: v }}
                    aria-pressed={v === (tool === 'draw' ? ink : art.color)}
                    onClick={() => (tool === 'draw' ? setInk(v) : setArt({ ...art, color: v }))}
                  />
                ))}
                {tookColour && (
                  <button type="button" aria-label="The colour you took from the photo" aria-pressed="true" style={{ background: shownColour }} />
                )}
                {mode === 'media' && file && (
                  <button
                    type="button"
                    className="st-dropper"
                    aria-label="Take a colour from the photo"
                    aria-pressed={picking}
                    onClick={() => setPicking(!picking)}
                  >
                    <Pipette size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
              )}
              {picking && <small className="st-hint">Tap the picture to take its colour.</small>}
              {tool === 'draw' && (
                <div className="st-pens" role="group" aria-label="Brush">
                  {(
                    [
                      ['pen', 'Pen', PenLine],
                      ['highlighter', 'Highlighter', Highlighter],
                      ['arrow', 'Arrow', MoveUpRight],
                      ['eraser', 'Eraser', Eraser],
                    ] as const
                  ).map(([v, label, Icon]) => (
                    <button type="button" key={v} aria-pressed={v === brush} onClick={() => setBrush(v)}>
                      <Icon size={15} aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {tool === 'draw' && (
                <div className="st-pens">
                  {pens.map((v, i) => (
                    <button
                      type="button"
                      key={v}
                      aria-label={['Fine pen', 'Medium pen', 'Thick pen'][i]}
                      aria-pressed={v === pen}
                      onClick={() => setPen(v)}
                    >
                      <i style={{ width: 4 + i * 3, height: 4 + i * 3 }} />
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={!art.strokes.length && !strokesBefore.length}
                    onClick={undoStroke}
                  >
                    <Undo2 size={15} aria-hidden="true" />
                    Undo
                  </button>
                </div>
              )}
              <button type="button" className="st-done" onClick={() => setTool(null)}>
                Done
              </button>
            </div>
          )}

          {composing && trayOpen && (
            <>
              <div className="st-tray-scrim" aria-hidden="true" onClick={() => setTrayOpen(false)} />
              <section className="st-tray" aria-label="Stamps and Play">
                <header>
                  <h2>Stamps and Play</h2>
                  <button type="button" className="st-done" onClick={() => setTrayOpen(false)}>
                    Done
                  </button>
                </header>
                <p className="st-tray-head">
                  <strong>Checked by Pantopus</strong>
                  <span>Nobody can type these</span>
                </p>
                {preview.isPending && !sv ? (
                  <p className="st-hint" role="status">
                    Reading the place…
                  </p>
                ) : (
                  <div className="st-tray-stamps">
                    {STAMP_KINDS.filter((k) => stampValue(k) != null).map((k) => {
                      const on = kept.some((st) => st.kind === k);
                      return (
                        <button key={k} type="button" aria-pressed={on} onClick={() => placeStamp(k)}>
                          <StampIcon kind={k} color={STAMP_TINT[k]} size={17} />
                          {k === 'postmark' ? 'Postmark' : stampLabel(k, stampValue(k))}
                        </button>
                      );
                    })}
                    {STAMP_KINDS.every((k) => stampValue(k) == null) && (
                      <p className="st-hint">
                        {noPlace ? 'Stamps need a place. Pick where it shows in the post settings.' : 'No stamps for this place yet.'}
                      </p>
                    )}
                  </div>
                )}
                {offersLooks && lookThumbs?.original && (
                  <>
                    <p className="st-tray-head">
                      <strong>Film looks</strong>
                      <span>{lookBusy ? 'Drawing the look…' : 'Colour and tone only'}</span>
                    </p>
                    <div className="st-filmlooks" role="group" aria-label="Film looks">
                      {FILM_LOOKS.map(({ look: l, title }) => (
                        <button key={l} type="button" aria-pressed={look === l} disabled={lookBusy} onClick={() => void pickFilmLook(l)}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- a small copy made on this device */}
                          <img src={lookThumbs[l]} alt="" />
                          <span>{title}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {stripPartners.length > 0 && (
                  <>
                    <p className="st-tray-head">
                      <strong>Photostrip</strong>
                      <span>One picture, one Moment</span>
                    </p>
                    <div className="st-tray-stamps">
                      <button type="button" disabled={stripBusy} onClick={() => void makeStrip()}>
                        <ImagePlus size={17} aria-hidden="true" />
                        {stripBusy
                          ? 'Making the strip…'
                          : `This and the next ${stripPartners.length === 1 ? 'photo' : `${stripPartners.length} photos`} in one strip`}
                      </button>
                    </div>
                  </>
                )}
                <p className="st-tray-head">
                  <strong>Play</strong>
                  <span>{making ? PLAY_MAKERS.find((m) => m.kind === making)?.label : 'Things people can touch'}</span>
                </p>
                {making ? (
                  <PlayMaker
                    key={`${making}-${playStart ? 'suggested' : 'own'}`}
                    kind={making}
                    taken={play}
                    start={playStart ?? undefined}
                    onAdd={(item, after) => {
                      setMaking(null);
                      setPlayStart(null);
                      if (!item) return;
                      setTrayOpen(false);
                      if (item.kind === 'before_after') {
                        // Suggested for two photos picked together: the second is the after, and leaves the queue.
                        if (after && files.length === 2 && after === files[1] && index === 0) setFiles([files[0]]);
                        if (after) void addAfter(item, after);
                        return;
                      }
                      setPlay([...play, item]);
                    }}
                  />
                ) : (
                  <div className="st-tray-stamps st-tray-play">
                    {canGuess && (
                      <button
                        type="button"
                        aria-pressed={guessSpot}
                        onClick={() => {
                          setGuessSpot(!guessSpot);
                          setTrayOpen(false);
                        }}
                      >
                        <i aria-hidden="true" />
                        Guess the spot
                      </button>
                    )}
                    {!playOn && <p className="st-hint">Polls, boards and the rest go on a post with a photo, or on a Moment.</p>}
                    {playOn && PLAY_MAKERS.filter((m) => (m.kind !== 'before_after' || canPair) && (m.kind !== 'moving_words' || canBlur)).map((m) => (
                      <button key={m.kind} type="button" disabled={play.length >= MAX_PLAY} onClick={() => setMaking(m.kind)}>
                        <i aria-hidden="true" />
                        {m.label}
                      </button>
                    ))}
                    {playOn && play.length >= MAX_PLAY && <p className="st-hint">Up to {MAX_PLAY} on one post.</p>}
                  </div>
                )}
              </section>
            </>
          )}

          {gate && !camera && (
            <div className="st-panel">
              {jobs.length > 0 ? (
                <>
                  <h3>Pending Moments</h3>
                  <p>Continue sharing the original Moment or discard the pending upload.</p>
                  {jobs.map((j) => (
                    <div className="st-pending" key={j.id}>
                      <strong>{j.parts[0].body.text || j.parts[0].body.caption || j.parts[0].body.kind + ' Moment'}</strong>
                      <small>{new Date(j.created).toLocaleString()}</small>
                      <div>
                        <button type="button" className="st-chip" disabled={!!busy} onClick={() => void submit(j)}>
                          Continue sharing
                        </button>
                        <button
                          type="button"
                          className="st-chip"
                          disabled={!!busy}
                          onClick={() =>
                            void (j.memoryOnly ? Promise.resolve() : discardJob(j.id))
                              .then(() => setJobs((v) => v.filter((x) => x.id !== j.id)))
                              .catch((e) => setError(messageOf(e, 'Couldn’t discard.')))
                          }
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              ) : preview.isError ? (
                <>
                  <h3>Post settings couldn’t load</h3>
                  <button type="button" className="st-chip" onClick={() => void preview.refetch()}>
                    Try again
                  </button>
                </>
              ) : !p ? (
                <p role="status">Opening the Studio…</p>
              ) : (
                <>
                  <h3>Share your first Moment</h3>
                  <p>You must be 18 or older to post Moments.</p>
                  <button type="button" className="st-post" disabled={!!busy} onClick={() => void confirmAge()}>
                    {busy || 'I am 18 or older'}
                  </button>
                  <button type="button" className="st-linkish" onClick={dismiss}>
                    Back to Moments
                  </button>
                </>
              )}
              {(busy || error) && (
                <p className="st-status" role={error ? 'alert' : 'status'}>
                  {busy || error}
                </p>
              )}
            </div>
          )}

          {wentOff && (
            <div className="st-panel st-wentoff" role="alertdialog" aria-modal="true" aria-labelledby="st-off-title">
              <h3 id="st-off-title">This isn’t on for you right now</h3>
              <p>
                {mode === 'text'
                  ? 'Your words go with you to the Moment composer.'
                  : `Your caption goes with you to the Moment composer. Pick the ${isVideo ? 'video' : 'photo'} again there.`}
              </p>
              <button type="button" className="st-post" autoFocus onClick={handBack}>
                Continue
              </button>
            </div>
          )}

          {discarding && (
            <div className="st-panel" role="alertdialog" aria-modal="true" aria-labelledby="st-discard-title">
              <h3 id="st-discard-title">Discard this Moment?</h3>
              <div className="st-pending-actions">
                <button type="button" className="st-chip" autoFocus onClick={() => setDiscarding(false)}>
                  Keep
                </button>
                <button type="button" className="st-post" onClick={backToStart}>
                  Discard
                </button>
              </div>
            </div>
          )}

          {!gate && !camera && mode === 'none' && (
            <div className="st-start">
              <p>Take a photo or a video, pick from your library, or write a few words.</p>
              <small>You can also drop a photo here.</small>
            </div>
          )}

          {!gate && !camera && (
            <div className="st-foot" ref={footRef}>
              {(busy || error || (askedPost && blocker)) && (
                <p className="st-status" role={busy ? 'status' : 'alert'}>
                  {busy || error || blocker}
                </p>
              )}
              {composing && canGuess && guessSpot && (
                <p className="st-status">Guess the spot: others see the picture, not the place, until they guess.</p>
              )}
              {composing && underPenName && penMe?.pen_name && (
                <p className="st-status">
                  Posting as {penMe.pen_name.name}. Others can&apos;t see it&apos;s you.
                  {penCheck.data?.warning ? ' ' + penCheck.data.warning : ''}
                </p>
              )}
              {mode === 'none' ? (
                <div className="st-dock" role="group" aria-label="Start with">
                  <button type="button" onClick={() => setCamera(true)}>
                    <Camera aria-hidden="true" />
                    Camera
                  </button>
                  <button type="button" onClick={() => input.current?.click()}>
                    <ImagePlus aria-hidden="true" />
                    Library
                  </button>
                  <button type="button" onClick={() => setMode('text')}>
                    <Type aria-hidden="true" />
                    Words
                  </button>
                </div>
              ) : (
                <>
                  {/* See the picture first (PHASE-5 A2): it opens whole; one Fit / Fill button, Turn and Reset on this
                      same screen (dragging moves it, the wheel or a pinch sizes it; Resize keeps its finer controls). */}
                  {mode === 'media' && file && !tool && !showAfter && (
                    <div className="st-adjust" role="group" aria-label="The picture">
                      <button
                        type="button"
                        className="st-chip"
                        disabled={!!busy || (!filled && fillsAlready)}
                        onClick={() =>
                          setArt({ ...art, zoom: filled ? fitAt(art.rotation) : fillAt(art.rotation), offset: { x: 0, y: 0 } })
                        }
                      >
                        {filled ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
                        {filled ? 'Fit' : 'Fill'}
                      </button>
                      <button
                        type="button"
                        className="st-chip"
                        disabled={!!busy}
                        onClick={turnQuarter}
                      >
                        <RotateCw size={15} aria-hidden="true" />
                        Turn
                      </button>
                      {/* While a loop is on, Trim stays in the row, off, so the row and the canvas keep their size (LEAD-8's
                          look, 09:36: the canvas grew to 361 px when Trim left the row). */}
                      {(canTrim || (isVideo && !!loopSpan)) && (
                        <button
                          type="button"
                          className="st-chip"
                          disabled={!!busy || !canTrim}
                          title={canTrim ? undefined : 'Take the loop off to trim'}
                          aria-pressed={trimOpen}
                          onClick={() => {
                            setLoopOpen(false);
                            setTrimOpen(!trimOpen);
                          }}
                        >
                          <Scissors size={15} aria-hidden="true" />
                          {trimOut ? `Trim · ${(trimOut.from_ms / 1000).toFixed(1)}–${(trimOut.to_ms / 1000).toFixed(1)} s` : 'Trim'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="st-chip"
                        disabled={!!busy || unmoved(art)}
                        onClick={() => setArt({ ...art, zoom: 1, rotation: 0, offset: { x: 0, y: 0 } })}
                      >
                        <Undo2 size={15} aria-hidden="true" />
                        Reset
                      </button>
                    </div>
                  )}
                  {mode === 'media' && file && !tool && caretAt?.field === 'caption' && (
                    <MentionPicker text={caption} caret={caretAt.at} picked={mentioned} enabled={canMention} onPick={(n) => pickMention('caption', n)} />
                  )}
                  {mode === 'media' && file && !tool && (
                    <input
                      ref={captionRef}
                      className="st-caption"
                      aria-label={postKind ? 'What it’s about' : 'Caption'}
                      maxLength={postKind ? 500 : 100}
                      value={caption}
                      disabled={!!busy}
                      onChange={(e) => {
                        setCaption(e.target.value);
                        followCaret('caption', e.target);
                      }}
                      onSelect={(e) => followCaret('caption', e.currentTarget)}
                      onBlur={() => setTimeout(() => setCaretAt((c) => (c?.field === 'caption' ? null : c)), 150)}
                      placeholder={postKind === 'ask_local' ? 'Ask something' : postKind ? 'Say what it’s about' : 'Add a caption'}
                    />
                  )}
                  {suggestion && !tool && (
                    <div className="st-kind-row" role="group" aria-label="Illuminate suggests">
                      <span className="st-kind-offer">
                        <button type="button" onClick={takeSuggestion}>
                          <Sparkles size={15} aria-hidden="true" />
                          {suggestion.words}
                        </button>
                        <button type="button" aria-label="No suggestion for this post" onClick={() => setSuggestDropped(true)}>
                          <X size={14} strokeWidth={2.6} aria-hidden="true" />
                        </button>
                      </span>
                    </div>
                  )}
                  {kindsOffered && !tool && (
                    <div className="st-kind-row">
                      {postKind ? (
                        <>
                          <span className="st-kind-chip">
                            {kindName(postKind)}
                            <button
                              type="button"
                              aria-label={`Keep it a Moment, not a ${kindName(postKind).toLowerCase()}`}
                              disabled={!!busy}
                              onClick={() => setKind(null)}
                            >
                              <X size={14} strokeWidth={2.6} aria-hidden="true" />
                            </button>
                          </span>
                          <span className="st-kind-hint">{kindHint(postKind)}</span>
                        </>
                      ) : (
                        <>
                          {offerAsk && (
                            <span className="st-kind-offer">
                              <button type="button" onClick={() => setKind('ask_local')}>
                                <MessageCircleQuestion size={15} aria-hidden="true" />
                                Keep until answered?
                              </button>
                              <button type="button" aria-label="No, keep it a Moment" onClick={() => setAskDeclined(true)}>
                                <X size={14} strokeWidth={2.6} aria-hidden="true" />
                              </button>
                            </span>
                          )}
                          <button
                            type="button"
                            className="st-kind-add"
                            aria-haspopup="menu"
                            aria-expanded={kindMenu}
                            disabled={!!busy}
                            onClick={() => setKindMenu((v) => !v)}
                          >
                            <Plus size={15} strokeWidth={2.6} aria-hidden="true" />
                            Ask / Kind
                          </button>
                        </>
                      )}
                      {kindMenu && !postKind && (
                        <div className="st-kind-menu" role="menu" aria-label="Make it a post that stays">
                          {STUDIO_KINDS.filter((k) => kindChoices.includes(k.kind)).map((k) => (
                            <button
                              key={k.kind}
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setKind(k.kind);
                                setKindMenu(false);
                              }}
                            >
                              <strong>{k.name}</strong>
                              <span>{k.hint}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {mode === 'text' && !postKind && (
                    <div className="st-swatches" role="group" aria-label="Background">
                      {(Object.keys(colors) as Background[]).map((k) => (
                        <button
                          type="button"
                          key={k}
                          aria-label={k + ' background'}
                          aria-pressed={bg === k}
                          onClick={() => setBg(k)}
                          style={{ background: colors[k] }}
                        />
                      ))}
                    </div>
                  )}
                  <div className="st-bar">
                    {/* The details as one line (PHASE-5 A4): where, how long and who sees it; a tap opens the drawer
                        (who sees it is chosen at its top). Nothing of them covers the picture until asked. The line is
                        also the sheet's handle: a drag up opens the details (PHASE-6 F3). */}
                    {!wide && <span className="st-grabber" aria-hidden="true" {...dragOpen} />}
                    <div className="st-row" {...(wide ? {} : dragOpen)}>
                      <button
                        type="button"
                        className="st-when st-summary"
                        data-kind={postKind || undefined}
                        aria-label={`${summary}. Change`}
                        aria-expanded={drawer}
                        disabled={!!busy}
                        onClick={() => {
                          if (wide) drawerRef.current?.focus();
                          else setDrawerOpen((v) => !v);
                        }}
                      >
                        {postKind ? <MessageCircleQuestion size={20} aria-hidden="true" /> : <Clock3 size={20} aria-hidden="true" />}
                        <span>
                          <strong>{summary}</strong>
                        </span>
                        <ChevronDown size={14} strokeWidth={2.6} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="st-post"
                        data-studio-post
                        disabled={!ready}
                        onClick={tryPost}
                      >
                        {busy ? '…' : 'Post'}
                        {!busy && <ArrowRight size={17} strokeWidth={2.6} aria-hidden="true" />}
                      </button>
                    </div>
                    {/* At home without the Sky the pin sits on the home: today's warning, every time, until confirmed
                        in the drawer. With the Sky (or Show the area) the first time only says why only the area shows. */}
                    {homeWarning && !homeAck ? (
                      <p className="st-why">This is your home. People will see the pin on it.</p>
                    ) : (
                      homeNote && area && !noPlace && <p className="st-why">Only the area is shown.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <input
            hidden
            ref={input}
            type="file"
            accept="image/*,video/*,.heic,.heif,.mov"
            multiple
            onChange={(e) => {
              choose(Array.from(e.target.files || []));
              e.target.value = '';
            }}
          />
        </div>
        {composing && drawer && (
          <>
            {!wide && <div className="st-scrim" aria-hidden="true" onClick={() => setDrawerOpen(false)} />}
            {settings}
          </>
        )}
      </div>
      <PenNameSetup open={setupOpen} onClose={() => setSetupOpen(false)} me={penMe} onTaken={() => choosePenName()} />
    </div>
  );
  return createPortal(stage, document.body);
}
