# What Render Check can check

Check a completed image or video before deciding whether to edit, review, or render again. [Connect an assistant](README.md#add-render-check-to-your-agent) · [Watch the Roadster example](https://x.com/VoopaApp/status/2123136658967290047) · [Plans and credits](https://voopa-render-check.onrender.com/plans)

Capability snapshot: 19 November 2026. 🟢 Automated measurement or candidate detection. 🟢− Evidence prepared for a compatible assistant or reviewer, or a comparison using information you supply. 🟠 Experimental or limited. 🔴 Not available. A green check is not a guarantee: review candidate findings in context.

## Image and video

| What you want to check | Status | How it works |
| --- | --- | --- |
| Image matches a brief | 🟢− | A vision-capable assistant reviews the image and stated requirements. |
| Video matches a brief | 🟢− | The assistant reviews sampled frames; moments between samples are not checked. |
| Objects, positions, clothing or props change between takes | 🟢− | Compare selected, labeled frames with an assistant. |
| Driver side, vehicle or deflector orientation | 🟢− | An assistant compares clear frames against the stated requirement. |
| Text, anatomy or crowd composition | 🟢− | A vision-capable assistant can inspect visible details against the brief. |
| Black gaps | 🟢 | Flags candidate dark passages with timestamps; dark scenes and fades can be intentional. |
| Frozen footage | 🟢 | Flags nearly unchanged frames or a selected fixed region. |
| Repeated shots | 🟢 | Finds candidate similar passages in a selected range; intentional or transformed repeats need review. |
| Compare separate parts of an edit | 🟢− | Compare selected windows or shot ranges for possible repeated material. |
| Movement in a selected region | 🟢 | Measures pixel changes; camera motion, cuts and lighting affect results. |
| Steam, clothing or a crowd moving naturally | 🟠 | Motion measurements can guide review; there is no semantic motion-quality verdict. |
| Missing shots, order and timeline gaps | 🟢− | Compares a supplied shot plan and declared inventory; it does not identify shots automatically. |
| Dark side bars | 🟢 | Flags candidate dark columns in sampled frames; intentional borders may be flagged. |
| Video size, orientation and duration | 🟢 | Checks supplied delivery requirements against video metadata. |
| Image dimensions and orientation | 🟢− | Checks encoded dimensions; display orientation can differ. |

## Audio and music

| What you want to check | Status | How it works |
| --- | --- | --- |
| Missing audio or silence in an expected interval | 🟢 | Flags missing tracks and quiet gaps; music or other sounds can mask a missing effect. |
| Audio levels, loudness and estimated peak | 🟢 | Measures selected intervals; listening is needed to judge quality. |
| Soundtrack against an approved reference | 🟢− | Compares selected audio excerpts and reports possible differences and timing. |
| Lyrics against a transcript | 🟢− | Compares supplied text; it does not transcribe the song. |
| Voice identity and consistency | 🟠 | Research only; no verified production speaker-identity detector. |
| Lip sync | 🟠 | Research only; not a reliable live verdict. |
| Sound effects match visible events | 🟠 | Research only; no reliable live audiovisual-event verdict. |

## Context and next step

| What you want to check | Status | How it works |
| --- | --- | --- |
| French street name | 🟢− | Looks up a supplied street and city in a current French address directory; it does not read the scene. |
| Historical weather context | 🟢− | Retrieves modeled daily data for supplied coordinates and date; not street-level weather or snow verification. |
| Suggest review, an edit or a targeted retry | 🟢− | Uses the evidence and attempt history supplied by the caller; it does not guarantee a better render or authorize spending. |
| Automatically review every render everywhere | 🔴 | The user or workflow must connect and invoke Render Check. |

Some checks are rate-limited preview tools; others use credits. [See the detailed documentation and pricing](README.md).
