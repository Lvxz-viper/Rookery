# Rookery 3.3

Chess server for your home computer: the website, online games, daily (correspondence) games,
accounts, friends, private messages, achievements, spectating, puzzles, an opening trainer,
Stockfish analysis and a control room.

## What is new in 3.3 (fair play)

- Fair-play checks: finished rated games are analysed with Stockfish in a separate low-priority process and players who
  repeatedly match the engine get an automatic report (nobody is punished automatically). Switch off under Server, Rules
- Rated games need two accounts on different networks; at most 5 rated games a day between the same pair
- Names cannot look like staff, use blocked words, or copy another player's name (guests included)
- Daily limits on friend requests, daily-game invitations, challenges and private messages
- Admins and moderators cannot edit their own accounts or results of their own games; only the owner can
- The website and control room only run their own scripts (Content-Security-Policy with script hashes)

## What is new in 3.2 (security)

- Sign-in tokens stored only as SHA-256 hashes; private messages and automatic backups encrypted with AES-256-GCM
  (key in `data/secret.key`, download a copy from the control room under Server, Security)
- Recovery codes for every account and a Forgot password screen; passwords need 8+ characters and no common words
- Accounts lock for 15 minutes after 10 wrong passwords; the control room locks for an hour after 30 failed sign-ins
- Signed-in devices list with sign-out, sign-in history and alerts on new sign-ins
- Two-step sign-in (authenticator app) for the owner and staff in the control room
- Emergency button that signs every player and staff session out
- Puzzle solves are verified on the server
- Limits on new guests and connections per network; unused guests and old sessions are cleaned up automatically

## What is new in 3.1

- Terms of Service, Privacy Policy, Community Rules, Licenses and Contact pages, linked in every page footer
- Sign-up requires accepting the terms and confirming an age of 13 or more; the acceptance is recorded
- Players can download all their data and delete their account from Settings
- Block and report players from their profile and from private messages
- Contact form; messages arrive in the control room under Reports
- Automatic data retention: private messages 1 year, network addresses 90 days without a visit
- Security headers (CSP, no framing, no sniffing) and rate limits on sign-ups, reports and contact
- Commercial use switch in Server: hides piece sets that only allow non-commercial use

## What is new in 3.0

- Daily chess with 1, 3 or 7 days per move, open games and invitations
- Private messages between friends
- 22 achievements, bios, countries and opening statistics on profiles
- Share links for every game and animated GIF replays
- Opening trainer that drills the main lines move by move
- Control room: full account editor (ratings, record, achievements, game results, profile),
  moderators and admins, word filter with automatic chat bans, analytics, server log,
  uptime monitoring and restore from backup

## Staff roles

The owner signs in to `/admin` with the admin password. Give a player the Moderator or Admin role
from their details; they then sign in to `/admin` with their own Rookery username and password.

| Role | Can do |
|---|---|
| Owner | Everything, including server settings, restarts, backups and roles |
| Admin | Edit any account, ratings, records, achievements and game results, word filter, analytics, logs |
| Moderator | Turn chat off, disconnect, suspend for up to 7 days, message players, handle reports |

## Update from version 1

```
pm2 stop rookery
tar -xf "%USERPROFILE%\Downloads\rookery-server-v2.zip" -C C:\server
cd C:\server\rookery-server
npm install
pm2 restart rookery
pm2 save
```

Your old players are moved to the new format automatically. The `data` folder is never replaced.

## First start

- Puzzles: the server downloads about 7,000 rated puzzles from the Lichess puzzle database by itself.
  It takes a minute. Until then a small built-in set is used.
- Admin password: open `data\ADMIN-PASSWORD.txt`, then go to `/admin` on your Rookery link.
  Change the password from the dashboard; the text file is deleted when you do.

## Automatic updates

`updater.js` checks github.com/Lvxz-viper/rookery every 5 minutes. When there is a new version it
replaces the program files (never `data`), installs packages if needed and restarts Rookery.
Start it once:

```
cd C:\server\rookery-server
pm2 start updater.js --name rookery-updater
pm2 save
```

See its status in the control room under Server, or with `pm2 logs rookery-updater`.

## Useful commands

| Command | What it does |
|---|---|
| `pm2 logs rookery` | Show games, sign-ins and errors |
| `pm2 restart rookery` | Restart after replacing files |
| `npm run puzzles` | Download the puzzles again by hand |

## Files

- `server.js` the server (port 3001, change with `set PORT=4000`)
- `core.js` chess rules, shared with the website; every move is checked on the server
- `puzzles.js` built-in puzzles and the Lichess downloader
- `fairplay.js` engine analysis of finished rated games
- `client/` the website source; `node tools/build.js` builds it into `public/index.html`
- `public/` the website, the admin page, Stockfish and fonts
- `data/` accounts, games, puzzles and the admin password. Back this folder up.

## Credits

Stockfish 18 (GPLv3), WASM build by Chess.com. Piece sets from the Lichess project:
Staunty, Gioco, Tatiana, Maestro and Cardinal by sadsnake1 (CC BY-NC-SA 4.0: free to use while Rookery is not
used to make money), Royal is a recolor of Celtic by Maurizio Monge (MIT), Classic by Colin M.L. Burnett (GPLv2+).
Puzzles from the Lichess puzzle database (CC0).
Fonts: Bodoni Moda and Onest (SIL Open Font License).
