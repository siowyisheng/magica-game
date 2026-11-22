import type { NameEntry } from '../statgen';

// Names for generated Summoners, each tagged with the stat profile it suits
// (z-scores against the reference Summoners: +1 is one spread above
// average). Every one is humanoid or demi-human; `look` is its sprite brief.
// The eight with an Element or Alignment always appear.

export const SUMMONER_NAMES: NameEntry[] = [
  // ranged (the range they suit)
  { name: 'Savage', ranged: 4, profile: { atk: 1, def: 1, spd: 1 }, look: 'tusked wild-folk huntress in bone armour hurling a crackling spear of green fire' },
  { name: 'Corsair', ranged: 3, profile: { atk: 0.5, mov: 1 }, look: 'sky-pirate with a tricorne and a brass spell-pistol, a little ghost parrot on the shoulder' },
  { name: 'Lancer', ranged: 4, profile: { atk: 1, def: 0.5 }, look: 'plumed javelin knight with a quiver of glowing lances on the back' },
  { name: 'Harpist', ranged: 5, profile: { mp: 1, atk: -0.5 }, look: 'elf bard plucking a harp whose strings are beams of light' },
  { name: 'Tracker', ranged: 6, profile: { mov: 0.5, spd: 0.5 }, look: 'lynx-eared hunter with an enormous antler longbow' },
  // Elements
  { name: 'Efreet', element: 'fire', profile: { atk: 1 }, look: 'red-skinned fire genie, lower body a swirling flame, scimitar' },
  { name: 'Sylph', element: 'air', profile: { spd: 1, mov: 1, def: -1 }, look: 'wind maiden with dragonfly wings and ribbons that float upward' },
  { name: 'Dwarf', element: 'earth', profile: { def: 1.5, spd: -1, mov: -1 }, look: 'braided-beard dwarf with a crystal-studded drill-hammer bigger than him' },
  { name: 'Selkie', element: 'water', profile: { mdf: 1, mp: 0.5 }, look: 'seal-folk girl wearing her seal-skin as a hooded cloak, holding a pearl' },
  // Alignments
  { name: 'Seraph', alignment: 'day', profile: { mdf: 1, mp: 1 }, look: 'six-winged angel with a halo of small suns' },
  { name: 'Templar', alignment: 'day', profile: { def: 1.5, mdf: 1, atk: 1 }, look: 'sun-crested holy knight with a cross-shaped greatsword' },
  { name: 'Vampire', alignment: 'night', profile: { atk: 1, mp: 0.5, def: -0.5 }, look: 'pale noble with bat-wing collar, a goblet of glowing blood' },
  { name: 'Banshee', alignment: 'night', profile: { mp: 1, mdf: 1, def: -1.5 }, look: 'ghostly wailing woman with streaming white hair and a lantern of blue soulfire' },
  // fighters
  { name: 'Oni', profile: { atk: 2, def: 1, mp: -1.5 }, look: 'horned blue ogre-demon with a spiked iron kanabo' },
  { name: 'Cyclops', profile: { atk: 1.5, def: 1.5, spd: -1, mov: -1 }, look: 'one-eyed giant carrying a boulder on the shoulder' },
  { name: 'Warlord', profile: { atk: 1.5, def: 1.5, mdf: 1, mp: -1.5 }, look: 'orc chieftain in spiked plate with a war banner on the back' },
  { name: 'Goliath', profile: { atk: 2, def: 2, mdf: 1, mp: -2 }, look: 'towering armoured giant with chains and a huge anvil-headed maul' },
  { name: 'Reaver', profile: { atk: 1.5, spd: 1, def: -1 }, look: 'scarred raider with twin crescent axes trailing red smoke' },
  { name: 'Ronin', profile: { atk: 1.5, spd: 1, mdf: -0.5 }, look: 'wandering samurai with a straw hat and a katana of blue lightning' },
  { name: 'Duelist', profile: { atk: 0.5, spd: 1.5, def: -0.5 }, look: 'feathered-hat fencer with a rapier that leaves rose petals' },
  { name: 'Valkyr', profile: { atk: 1, def: 1, mov: 1.5, mp: -1 }, look: 'winged-helm shield maiden with feathered wings and a spear' },
  { name: 'Centaur', profile: { mov: 2, atk: 1, spd: 0.5 }, look: 'horse-bodied warrior with a star-painted flank and a glaive' },
  { name: 'Bastion', profile: { def: 2, mdf: 1.5, spd: -1, mov: -1 }, look: 'living fortress knight with a castle-tower shield and a tiny flag' },
  // casters
  { name: 'Lich', profile: { mp: 2, atk: -1.5, def: -1.5, mdf: 0.5 }, look: 'skeletal sorcerer in a crown, green soul-gem phylactery floating in the ribcage' },
  { name: 'Oracle', profile: { mp: 1.5, mdf: 1, atk: -1.5, spd: -1 }, look: 'blindfolded seer with a third eye glowing on the brow and a crystal ball' },
  { name: 'Witch', profile: { mp: 1.5, atk: -1.5, def: -1, mdf: -1 }, look: 'pointy-hat witch riding a side-saddle broom, a bubbling cauldron charm' },
  { name: 'Magus', profile: { mp: 2, atk: -1.5, spd: -1, mov: -1 }, look: 'long-bearded archmage with a floating open grimoire and orbiting runes' },
  { name: 'Warlock', profile: { mp: 1, atk: -0.5, mdf: 0.5 }, look: 'hooded pact-mage with a demon-eye staff and a shadow tentacle cape' },
  { name: 'Abbess', profile: { mdf: 2, def: 0.5, atk: -1.5 }, look: 'veiled nun with a giant rosary of glowing beads' },
  { name: 'Kitsune', profile: { mp: 1, spd: 1, mov: 1, atk: -1 }, look: 'fox-eared shrine maiden with nine glowing tails and foxfire wisps' },
  { name: 'Sphinx', profile: { mdf: 1.5, mp: 1, mov: -1 }, look: 'lion-pawed pharaoh-sage with a striped nemes headdress and an ankh' },
  { name: 'Hermit', profile: { mp: 1, mdf: 1, spd: -1.5, mov: -1 }, look: 'hunched mushroom-capped hermit with a lantern on a crooked staff' },
  { name: 'Druid', profile: { mp: 1, def: 0.5, mdf: 0.5, spd: -0.5 }, look: 'antlered druid with moss robes and a sprouting staff' },
  // skirmishers and oddballs
  { name: 'Satyr', profile: { spd: 1.5, mov: 1, def: -1 }, look: 'goat-legged piper with panpipes that puff musical notes' },
  { name: 'Tengu', profile: { spd: 2, mov: 1.5 }, look: 'crow-headed mountain monk with a feather fan and one-tooth geta' },
  { name: 'Shadow', profile: { spd: 1.5, atk: 1, def: -1 }, look: 'masked ninja made of living shadow with a crescent kunai' },
  { name: 'Jester', profile: { spd: 1.5, mdf: 1, atk: -1, def: -1 }, look: 'harlequin with a bell cap and a grinning puppet on one hand' },
  { name: 'Wraith', profile: { mdf: 2, def: -1.5 }, look: 'hooded wisp of a figure with no face, only two eyes, and a spectral scythe' },
  { name: 'Gorgon', profile: { mdf: 1.5, def: 0.5, atk: 0.5, spd: -0.5 }, look: 'serpent-haired queen whose hair-snakes hiss, holding a mirror shield' },
  { name: 'Lamia', profile: { mdf: 1, atk: 0.5, mov: -0.5 }, look: 'snake-tailed sorceress with jewelled scales and a golden serpent staff' },
  { name: 'Naga', profile: { def: 1, mp: 1, mov: -1 }, look: 'cobra-hooded serpent prince with a trident' },
  { name: 'Mummy', profile: { def: 1, mdf: 1, spd: -1 }, look: 'bandaged pharaoh with loose wrappings floating and a golden death mask' },
  { name: 'Regent', profile: { def: 0.5, mdf: 0.5 }, look: 'young king with an oversized crown and a sceptre topped by a caged star' },
  { name: 'Herald', profile: { spd: 1, mdf: 0.5 }, look: 'winged-boot messenger blowing a long golden trumpet' },
];
