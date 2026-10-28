# Contributing to Mirror Mirror

Thanks for helping make browser recording more dependable.

## Get started

1. Fork and clone the repository.
2. Use Node.js 22.12 or newer, then run `npm ci` and `npm run dev`.
3. Make a focused change on a branch.
4. Run `npm run check`. For capture, audio, composition, or recording-flow changes, also run `npm run test:browser` after `npx playwright install chromium`.
5. Open a pull request describing the user-visible change, validation performed, and any remaining limits.

Prefer plain JavaScript modules and browser APIs. Keep device ownership, drawing, audio mixing, and recording lifecycle separate. Do not introduce a backend, analytics, upload path, or large framework without discussing the intended change first.

## Reporting bugs

Include the browser/version, operating system, selected sharing source (tab/window/screen), whether shared audio was available, and the exact steps. Describe what you expected and what happened. A minimal generated example is better than a private recording.

Do not post credentials, private screen contents, identifiable recordings, or device labels containing personal details. For a sensitive report, use GitHub's private reporting option if the repository offers it; otherwise ask the maintainers for a private contact without disclosing the vulnerability in a public issue.

## Manual recording checklist

Automated tests use generated media. For changes affecting real capture, record what you checked on actual hardware:

- Allow and decline screen/camera/microphone permissions; cancellation should release acquired sources.
- Check the microphone meter, selected devices, and shared-audio availability.
- Record with both audio sources; verify both in playback without feedback or unexpected clipping.
- Change slides and windows during a five-minute recording while keeping the recorder visible.
- Pause/resume, stop from the app, and stop sharing from browser controls.
- Save and open the downloaded file in a player; verify sound, motion, and face placement.
- Make a second take without reloading. Check that the camera and microphone stop after each take.
- Deliberately hide the recorder and verify the warning; document any frozen frames rather than claiming background capture works.

## Repository hygiene

Keep `package-lock.json` committed. Never commit `recordings/`, media exports, `.env` files, dependencies, generated builds, or test artifacts. Use generated content for documentation images and test fixtures; change ignore rules explicitly if a reviewed media fixture is genuinely needed.

Contributions are accepted under the project's [MIT license](LICENSE). Be respectful and constructive in issues and reviews.
