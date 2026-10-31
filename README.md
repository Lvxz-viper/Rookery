# Rookery 3.0

Chess server for your home computer: the website, online games, daily (correspondence) games,
accounts, friends, private messages, achievements, spectating, puzzles, an opening trainer,
Stockfish analysis and a control room.

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
- `client/` the website source; `node tools/build.js` builds it into `public/index.html`
- `public/` the website, the admin page, Stockfish and fonts
- `data/` accounts, games, puzzles and the admin password. Back this folder up.

## Credits

Stockfish 18 (GPLv3), WASM build by Chess.com. Piece sets from the Lichess project:
Staunty, Gioco, Tatiana, Maestro and Cardinal by sadsnake1 (CC BY-NC-SA 4.0: free to use while Rookery is not
used to make money), Royal is a recolor of Celtic by Maurizio Monge (MIT), Classic by Colin M.L. Burnett (GPLv2+).
Puzzles from the Lichess puzzle database (CC0).
Fonts: Bodoni Moda and Onest (SIL Open Font License).
