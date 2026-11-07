# Pictures: one size to give, four made from it

## What the founder gives for a new card

One picture file, plus two lines of words:

| Give | What |
|---|---|
| **The picture** | 1500 × 1600 pixels (15:16), PNG or high-quality JPEG, in normal sRGB colour |
| **The caption** | The handwritten line under the picture, for example "Come finish our snowman." |
| **The collection** | Which of the six it belongs to, or the name of a new one |

Inside the picture:

- No border, caption, postmark, date or other text. The app prints those.
- The picture fills the whole 1500 × 1600, edge to edge.
- Keep faces and anything important away from the outer edge, about 5% (75 pixels).

## What gets made from it

Nobody makes these by hand. Everything below comes from that one file:

| Made from it | Size | How |
|---|---|---|
| The card in the apps | Whole card 5:6 (the picture, plus a cream border and printed strip) | The app prints the border, caption, "CHRISTMAS, 2026" and postmark around the picture |
| Website copy the apps load | 1320 wide, and a 360-wide thumbnail | Scripted when the picture is added |
| Story picture | 1080 × 1920 | Drawn on the person's phone when they share |
| Post picture | 1080 × 1350 | Drawn on the person's phone when they share |
| Link preview | 1200 × 630 | Rendered once when the picture is added, kept on the website |

Adding a picture takes a server and website update only, with no new store builds. Number new pictures on from 50 and never reuse a number, because the card's stamp comes from its number (`["fir","peak","river"][(n-1)%3]`).

## Why phone sizes aren't a problem

The card has one fixed shape and scales to the phone's width. What changes from phone to phone is how much of the envelope flap and table shows. The sample was checked at 375×667 (iPhone SE), 360×780 and 412×915 (Android sizes), and 440×956 (iPhone Pro Max); see [reference/phone-sizes.jpg](reference/phone-sizes.jpg). A full-screen photo would have needed a different crop for each phone shape, and Android screens range from about 16:9 to 21:9.

## The 49 existing pictures

They don't need redoing. They're all about 1122 pixels wide, but heights run from 1131 to 1246, and each has a cream border baked in (about 12–25 pixels). Inside the border, their shapes run from 0.897 to 0.988 wide-to-high.

| Shape to trim to | Most cut from one side | Typical cut |
|---|---|---|
| **15:16 (chosen)** | **5.1%** | **2.4%** |
| 19:20 | 5.6% | 2.6% |
| 10:11 | 8.0% | 3.3% |
| 1:1 | 10.3% | 6.0% |
| 4:5 | 19.0% | 14.9% |

[designs-table.json](designs-table.json) has each picture's crop box (in its full-size file), table colour and web name. The crop is centred. The pictures that lose most are 24 and 31 (5.1%), 26 (4.4%), 13 (4.3%), 29 (4.2%), 9 (4.1%) and 19 (4.0%). Check those by eye and move the crop if a face gets close to an edge.

The border finder can be fooled by snow at the picture's edge. It read 0 or too much on pictures 2, 4, 9, 11, 29 and 48, so `all_pictures.py` limits each edge to between about 10 and 26 pixels. Check those six as well.

**Sharpness:** a card on an iPhone 17 Pro needs about 1110 pixels across the picture, so the existing crops (about 1085 wide) are close to one-to-one, where the apps' current 960-wide copies are visibly softer. The largest phones need about 1330, so existing pictures run slightly soft there. It's acceptable. New pictures at 1500 cover every phone and leave room to zoom.

Old apps keep using today's files, so those stay. The new copies go in a new folder (see [build-plan.md](build-plan.md)).

## Table colours

Each picture's table is one of four cloth colours. A simple rule picks it from the picture, and the founder can change any of them:

| Name | Colour | When |
|---|---|---|
| slate | `#3b4c6e` | Bright snow scenes |
| dusk | `#2c4071` | Dark, blue evenings |
| umber | `#6e4b30` | Warm rooms |
| wine | `#704b51` | In between |

[reference/all-49-pictures-with-table-colours.jpg](reference/all-49-pictures-with-table-colours.jpg) shows them all. The apps don't need 49 table images. They tint one shared grey cloth image with the colour, and only the sample's three tables are baked.

## Remaking the art

Everything in `sample/a/` comes from `sample/art/`. Run from that folder, with Pillow, numpy and scipy installed. The `.cjs` scripts need Playwright and Chrome; set `PLAYWRIGHT_TEST` to the path of `@playwright/test` if this worktree has no `node_modules`.

1. `measure_pictures.py`: measures the full-size crops in `~/Downloads`, writing `out/pictures.json`.
2. `node raster.cjs mark.html out/mark.png 512 512 1`, then `node raster.cjs postmark.html out/postmark.png 540 270 2`, then for each of `peak`, `fir` and `river`: `node raster.cjs "stamps.html#peak" out/stamp-peak.png 288 372 2`.
3. `wax.py`, `envelope.py`, `front.py`, `paper_tile.py`: the seal, envelope layers, front, stamps, postmark, paper and grain.
4. `pictures.py`: the three sample pictures, their tables and the window light.
5. `all_pictures.py ../../../../../backend/services/holidayCards.js`: `designs-table.json` and the sheet of all 49.
6. With `sample/` served on port 18990: `make_share.cjs` renders the share pictures.

`shot.cjs` and `flow.cjs` take screenshots of the page. `drag.py` drives a finger on a simulator (`SIM_UDID` in the environment).
