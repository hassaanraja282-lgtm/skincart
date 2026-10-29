# SkinCart ◐ One selfie. Your whole routine.

SkinCart turns a single selfie into a personalised beauty shopping experience, powered by the **YouCam API**:

1. **AI Skin Analysis** scores 10 concerns (breakouts, pores, texture, fine lines, redness, oil, hydration, dark circles, dark spots, radiance), plus an overall score and skin age, with a per-concern map drawn on your face.
2. **AI Facial Color Tones Analyzer** measures your exact skin, eye, hair and lip colour.
3. SkinCart's recommender turns those numbers into:
   - a **routine** (cleanse → treat → eyes → moisturise → SPF) that targets your weakest scores, with a plain-English reason on every product;
   - a **foundation shade match** chosen by colour distance (CIE ΔE in Lab space) across 16 shades, with your undertone (warm / neutral / cool) and depth;
   - **lip colours** curated for your undertone.
4. **AI Makeup Virtual Try-On** renders any recommended lip or foundation shade on your own photo, with a before/after slider, so you can try before you buy.
5. Add the routine or any shade to the **cart** (bundle saving for 3+ items) and check out.

## Why it matters
Online beauty shoppers guess at shades and skincare actives, which drives returns and wasted money. SkinCart replaces guessing with measurement: every product in the cart is tied to a score or colour the AI actually measured on the shopper's face.

## YouCam APIs used
| API | Endpoint | Used for |
| --- | --- | --- |
| File API | `POST /s2s/v2.0/file` | Secure upload of the selfie (pre-signed PUT) |
| AI Skin Analysis | `POST /s2s/v2.0/task/skin-analysis` | 10 SD concerns, `format: json`, mask overlays |
| AI Facial Color Tones Analyzer | `POST /s2s/v2.0/task/skin-tone-analysis` | Skin / eye / hair / lip colours → undertone, depth, shade match |
| AI Makeup Virtual Try-On | `POST /s2s/v2.0/task/makeup-vto` | `lip_color` and `foundation` effects in the matched shade |

Skin analysis and tone analysis run **in parallel** on the same uploaded `file_id`; results are cached per image hash so a selfie never spends units twice.

## Run it
```bash
npm install
cp .env.example .env   # add your YOUCAM_API_KEY
npm start              # http://localhost:3000
```
Without a key the app runs in **demo mode** using a real, pre-recorded YouCam result for the sample face.

Deploy: one click on Render with `render.yaml` (set `YOUCAM_API_KEY`).

## Stack
Node.js 18+ / Express backend (keeps the API key server-side), vanilla HTML/CSS/JS front end, no build step. `npm test` runs the recommender unit tests.

## Notes
Products are SkinCart house-brand demo items; checkout is a demo and takes no payment. Not medical advice.

License: MIT
