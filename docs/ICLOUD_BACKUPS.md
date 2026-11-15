# Encrypted backups in iCloud Drive

Owner approved iCloud storage for encrypted backups. Copied the existing three encrypted data archives on November15 UTC into a new exclusive folder:

/Users/sam/Library/Mobile Documents/com~apple~CloudDocs/Curated Chaos Encrypted Backups 2026-11-15T04-29-04-184Z ab69fa81-ed55-43a0-8d95-c5e613dd4f18

The files are the historical46-provider archive, updated68-provider archive and earlier129-record private-workspace archive. Original local files were preserved. Their encrypted bytes were checked against the sources using SHA256 after copying. No plaintext records, encryption key or credential recovery kit were copied. Finder listed three items, 122.34GB available on iCloud and Downloaded status for each. This is Finder status, not an independent remote restore test. Evidence: /private/tmp/curated-icloud-encrypted-backups.png.

The workspace archive predates the22 newer transactions; the68-provider archive contains them. These are selected app backups, not a full Mac or full database backup. No ongoing schedule was created.

## Remaining recovery requirement

The data archives require the existing local encryption key. The existing password-protected .ccrecovery file contains credentials and remains local. A dedicated owner-run key-only recovery tool is ready:

/usr/local/bin/node /Users/sam/Developer/Curated-Chaos/tools/create-icloud-key-recovery.mjs --create

The tool asks for a new private backup password twice in Terminal, verifies password-encryption of only the original key, then writes exclusive copies in private local Recovery and a separate iCloud folder. It includes no account credentials, changes no active key, and requires no password in chat. Keep the password in a password manager accessible without this Mac. The tool has not been run with the real key. Automated Terminal opening was blocked by the computer-use app restriction; the owner must open Terminal and start the command. No alternative UI automation was attempted.

All1,651 local tests/checks pass, including exclusive encrypted cloud staging, rejection of credential/plaintext/symlink sources and password-protected key-only recovery using fictional keys. Password entry and final cloud key-file verification remain outstanding. Do not claim recovery after Mac loss is complete until that step is done.

## Owner-completed key recovery setup verified

Owner reported completion of the password-entry tool. Found one399-byte password-encrypted key-only recovery file, curated-chaos-key-b76f2d76-8bc3-4956-8dd2-306288f0ce05.cckeyrecovery, in private local Recovery and iCloud folder Curated Chaos Key Recovery cea16d4e-bfb5-42d7-9916-235d6b6da988. Ciphertext copies matched byte for byte (SHA256 3d527d31517ed822478e71a8fd28937d9e07e6b5a366a9ad4f3f9eaf14604b06); envelope salt/IV/tag lengths verified without decryption or password access. Finder reports Downloaded. Proof: /private/tmp/curated-icloud-key-recovery-verified.png. The owner-run tool verifies password decryption before writing; this follow-up did not repeat decryption or perform a remote restore. Keep the password in a password manager accessible without this Mac. Credentials recovery kit remains local; only password-wrapped data key was copied. Static iCloud recovery copies are in place; no recurring backup schedule, full-Mac backup or full-database recovery is claimed.
