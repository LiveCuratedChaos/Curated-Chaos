# Open Curated Chaos on this Mac

Use the desktop file **Open Curated Chaos.command**. It runs the existing project launcher without copying application files or credentials.

- If the same development workspace is running, the launcher opens it without starting a second copy or closing its sign-in.
- If nothing is listening at the app address, it starts the guarded workspace and opens the browser. Keep the Terminal window open while using the app; Control-C stops it and closes its temporary sign-ins.
- If the address responds as an unexpected service, another project or an older incompatible version, the launcher stops without killing or replacing anything. Ask for help reviewing that state.
- Sign in with the existing email used for the verified recovery test. Forgot your password is available from the signed-out screen. Opening recovery alone sends nothing.

This remains the separate Mac development app, not a hosted production deployment. It needs the Mac running and network access for saved development records. A desktop shortcut does not provide offline operation, hosting or a backup. Do not start another server manually just because the browser cannot connect.

## Implementation and verification

Desktop wrapper: /Users/sam/Desktop/Open Curated Chaos.command, created exclusively without overwriting existing files. It executes /Users/sam/Developer/Curated-Chaos/tools/Open-Private-Workspace.command. Wrapper and launcher shell syntax checked.

The launch probe requests only the same loopback address's /private-workspace-status.json without cookies or credentials, follows no redirects and uses a short timeout. It requires an exact narrow development marker, project, protocol and enabled recovery/saved-account capabilities. Only connection refused permits starting a new process; timeouts, unknown services, malformed replies, mismatched projects and unexpected capabilities stop. This is accidental-address protection, not a cryptographic identity guarantee against a compromised local machine.

The status endpoint exposes no user, tokens, records or provider data and performs no authentication or database access. It is unavailable to generic fixture/static configurations without a guarded project reference. Existing host/origin restrictions remain. Two real read-only probes confirmed the running workspace; fictional tests cover refusal states and factory wiring.
