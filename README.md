# Pete's 50th · petermas.world

## Changing the music

The music is one YouTube playlist in `frontend/src/music.js`. It plays in order, then loops.
Dancing Queen (club remix) plays first when the card opens.

To change the songs, you only need to edit the `SET` list. Each YouTube link has an ID after
`youtu.be/` or `v=`. For example, in `youtu.be/wKduhUXa0rg` the ID is `wKduhUXa0rg`.

```js
const SET = [
  { id: 'hr9nbe_bcg8', title: 'ABBA – Dancing Queen (club remix) · No.1 the week Pete was born' },
  { id: 'wKduhUXa0rg', title: 'Messiah – Temple of Dreams (1992)' },
  // add a song: { id: 'THE_ID', title: 'Artist – Song' },
]
```

- The `title` is what shows on the decks icon as "now playing".
- If YouTube won't let a video play inside another site, the card skips to the next one.
- After changing it: commit, push, then Deploy **pete-card-live** in Coolify.
