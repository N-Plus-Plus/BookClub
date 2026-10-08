// Runtime URLs stay stable; only these originals belong in the frontend payload.
export const imageAssets = [
  ...['home', 'history', 'builder', 'classsics', 'seen', 'metrics', 'admin', 'filmdetails', 'event']
    .map(name => ({source: `buttons/${name}.png`, output: `buttons/${name}.png`, size: 128})),
  ...[...Array.from({length: 20}, (_, i) => String(i)), 'a']
    .map(name => ({source: `avatars/${name}.png`, output: `avatars/${name}.png`, size: 320})),
  {source: 'newFav/fav1.png', output: 'newFav/fav1.png', size: 96},
  {source: 'newFav/fav1.png', output: 'favicon.png', size: 32},
];

export const imageRecipe = {
  version: 1,
  format: 'png',
  resize: {fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3'},
  // Full RGBA, no palette quantisation or lossy colour reduction.
  png: {compressionLevel: 9, adaptiveFiltering: true, palette: false},
};
