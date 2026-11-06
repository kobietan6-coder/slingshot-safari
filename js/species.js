/* Slingshot Safari — species catalogue.
 * Weights (kg) are adult ranges taken from the species' Wikipedia articles
 * (and standard field guides where Wikipedia gives none). w = [min,max] or {m:[..], f:[..]} for sexually dimorphic species.
 * Status = IUCN Red List category. Art params drive the procedural canvas renderer in art.js.
 */
(function () {
  const REGIONS = [
    { id: 'meadow', name: 'Lowland Meadow', unlock: 1, blurb: 'Open grassland and garden edge. Fast songbirds, foxes and rabbits.',
      sky: ['#2b3a3f', '#5f7068', '#a7a68a'], hills: ['#2c3a2f', '#3b4a35', '#4f5c3f'], ground: ['#4a5634', '#2d3621'], mist: 'rgba(200,205,180,0.10)' },
    { id: 'rainforest', name: 'Lowland Rainforest', unlock: 3, blurb: 'Dipterocarp canopy of the Malay Peninsula. Hornbills, macaques, pangolins.',
      sky: ['#18241f', '#2f4636', '#6a7a5a'], hills: ['#14211a', '#1d2f22', '#284030'], ground: ['#2d3b24', '#1a2416'], mist: 'rgba(190,210,190,0.14)' },
    { id: 'mangrove', name: 'Mangrove Estuary', unlock: 5, blurb: 'Tidal mudflats and mangrove roots. Kingfishers, otters, sea eagles.',
      sky: ['#1e2c33', '#41606a', '#9aa59a'], hills: ['#1b2a2a', '#24383a', '#2f4746'], ground: ['#3d4a3c', '#262f28'], mist: 'rgba(190,215,215,0.12)' },
    { id: 'highlands', name: 'Highlands & Plains', unlock: 8, blurb: 'Dry ridges and open plains at dusk. Raptors, kangaroos, boar and sambar.',
      sky: ['#2a2528', '#6b4f42', '#c08a5a'], hills: ['#2b2422', '#3d302a', '#564030'], ground: ['#5b4a32', '#3a2e20'], mist: 'rgba(230,190,150,0.10)' },
  ];

  // move: flit | fly | soar | dive | walk | run | hop | scurry | roo
  const S = [
    // ---------- MEADOW ----------
    { id: 'magpie_robin', name: 'Oriental Magpie-Robin', sci: 'Copsychus saularis', cls: 'Bird', family: 'Muscicapidae', familyCommon: 'Old World flycatchers',
      region: 'meadow', rarity: 'common', status: 'LC', w: [0.031, 0.041], habitat: 'Gardens, open woodland and parks across South and Southeast Asia; common in Singapore.',
      wiki: 'Oriental magpie-robin', move: 'flit', speed: 190, hp: 1, size: 50,
      art: { t: 'bird', back: '#1c1f26', belly: '#e6e2d6', head: '#1c1f26', wing: '#1f232b', patch: '#e3e0d6', tail: '#16181d', tailL: 0.6, beak: '#1a1a1a', beakL: 0.22 },
      artF: { back: '#4c4f55', head: '#55585e', wing: '#45484e', tail: '#3a3c41' } },
    { id: 'common_myna', name: 'Common Myna', sci: 'Acridotheres tristis', cls: 'Bird', family: 'Sturnidae', familyCommon: 'Starlings and mynas',
      region: 'meadow', rarity: 'common', status: 'LC', w: [0.082, 0.143], habitat: 'Open woodland, farmland and urban areas; native to South Asia, introduced widely.',
      wiki: 'Common myna', move: 'fly', speed: 175, hp: 1, size: 58,
      art: { t: 'bird', back: '#5b3f2c', belly: '#6e4d37', head: '#1c1916', wing: '#4b3424', patch: '#e9e4d8', tail: '#1e1a17', tailL: 0.35, beak: '#e2b33b', beakL: 0.22, mask: '#e2b33b' } },
    { id: 'javan_myna', name: 'Javan Myna', sci: 'Acridotheres javanicus', cls: 'Bird', family: 'Sturnidae', familyCommon: 'Starlings and mynas',
      region: 'meadow', rarity: 'common', status: 'VU', w: [0.09, 0.11], habitat: 'Urban parks, roadsides and grassland; native to Java and Bali, abundant in Singapore.',
      wiki: 'Javan myna', move: 'fly', speed: 170, hp: 1, size: 56,
      art: { t: 'bird', back: '#3c3e43', belly: '#55585e', head: '#18191c', wing: '#34363b', patch: '#e9e7e0', tail: '#202125', tailL: 0.35, beak: '#e4bf3e', beakL: 0.22, crest: '#18191c', vent: '#ece9e2' } },
    { id: 'rr_parakeet', name: 'Rose-ringed Parakeet', sci: 'Psittacula krameri', cls: 'Bird', family: 'Psittaculidae', familyCommon: 'Old World parrots',
      region: 'meadow', rarity: 'uncommon', status: 'LC', w: [0.104, 0.143], habitat: 'Woodland, farmland and city parks; native to Africa and South Asia, feral populations worldwide.',
      wiki: 'Rose-ringed parakeet', move: 'fly', speed: 245, hp: 1, size: 66,
      art: { t: 'bird', back: '#5f9e45', belly: '#8cc06a', head: '#6aa84f', wing: '#4f8a3b', tail: '#5a9585', tailL: 1.0, beak: '#b5302a', beakL: 0.2, hook: true, collar: '#1a1a1a', collar2: '#d07a8e' },
      artF: { collar: null, collar2: null } },
    { id: 'pn_green_pigeon', name: 'Pink-necked Green Pigeon', sci: 'Treron vernans', cls: 'Bird', family: 'Columbidae', familyCommon: 'Pigeons and doves',
      region: 'meadow', rarity: 'uncommon', status: 'LC', w: [0.105, 0.16], habitat: 'Mangroves, secondary forest and parks with fruiting trees across Southeast Asia.',
      wiki: 'Pink-necked green pigeon', move: 'fly', speed: 200, hp: 1, size: 58,
      art: { t: 'bird', back: '#717f37', belly: '#9aa94a', head: '#8796a5', throat: '#c98399', wing: '#55632a', patch: '#d8c04a', tail: '#6d7170', tailL: 0.38, beak: '#a9b3a6', beakL: 0.16 },
      artF: { head: '#87993f', throat: '#9aa94a' } },
    { id: 'hoopoe', name: 'Common Hoopoe', sci: 'Upupa epops', cls: 'Bird', family: 'Upupidae', familyCommon: 'Hoopoes',
      region: 'meadow', rarity: 'rare', status: 'LC', w: [0.046, 0.089], habitat: 'Open country with scattered trees, orchards and steppe across Afro-Eurasia.',
      wiki: 'Common hoopoe', move: 'flit', speed: 160, hp: 1, size: 60,
      art: { t: 'bird', back: '#c48a5e', belly: '#d7a07a', head: '#c9905f', wing: '#1d1b19', bars: '#e9e2d3', tail: '#1d1b19', tailL: 0.42, beak: '#2a2622', beakL: 0.42, curve: 0.25, crest: '#c9905f', crestTip: '#161412', crestBig: true } },
    { id: 'mallard', name: 'Mallard', sci: 'Anas platyrhynchos', cls: 'Bird', family: 'Anatidae', familyCommon: 'Ducks, geese and swans',
      region: 'meadow', rarity: 'common', status: 'LC', w: [0.7, 1.6], habitat: 'Lakes, rivers, marshes and park ponds throughout the Northern Hemisphere.',
      wiki: 'Mallard', move: 'fly', speed: 185, hp: 1, size: 78,
      art: { t: 'bird', duck: true, back: '#6c5b49', belly: '#a8a59c', head: '#1f5c3d', throat: '#6c3a28', collar2: '#e8e6e0', wing: '#7b766c', patch: '#3a55a0', tail: '#2c2a28', tailL: 0.22, beak: '#d5b13f', beakL: 0.26, flat: true },
      artF: { back: '#7d6247', belly: '#9c8064', head: '#7a6148', throat: '#8a6c4e', collar2: null, wing: '#715a43', tail: '#6b553e', beak: '#c87a38' } },
    { id: 'eu_rabbit', name: 'European Rabbit', sci: 'Oryctolagus cuniculus', cls: 'Mammal', family: 'Leporidae', familyCommon: 'Rabbits and hares',
      region: 'meadow', rarity: 'common', status: 'EN', w: [1.5, 3.0], habitat: 'Grassland, heath and farmland; native to Iberia, introduced across Europe and Australia.',
      wiki: 'European rabbit', move: 'hop', speed: 150, hp: 1, size: 62,
      art: { t: 'quad', fur: '#86725d', back: '#6d5b48', belly: '#d6cdbd', bodyL: 0.62, bodyH: 0.38, legL: 0.16, headL: 0.28, snout: 0.08, ear: 'long', earS: 0.36, tail: 'puff', tailC: '#ece8df' } },
    { id: 'red_fox', name: 'Red Fox', sci: 'Vulpes vulpes', cls: 'Mammal', family: 'Canidae', familyCommon: 'Dogs, wolves and foxes',
      region: 'meadow', rarity: 'rare', status: 'LC', w: [2.2, 14.0], habitat: 'Forest edge, farmland, tundra and cities across the Northern Hemisphere.',
      wiki: 'Red fox', move: 'run', speed: 185, hp: 2, size: 108,
      art: { t: 'quad', fur: '#c0622c', back: '#a24e22', belly: '#efe7da', legs: '#231c18', bodyL: 0.58, bodyH: 0.26, legL: 0.28, headL: 0.24, snout: 0.16, ear: 'point', earS: 0.13, earC: '#2a1f18', tail: 'bushy', tailL: 0.5, tailC: '#b85a28', tailTip: '#f0ebe0' } },
    { id: 'plantain_squirrel', name: 'Plantain Squirrel', sci: 'Callosciurus notatus', cls: 'Mammal', family: 'Sciuridae', familyCommon: 'Squirrels',
      region: 'meadow', rarity: 'uncommon', status: 'LC', w: [0.16, 0.259], habitat: 'Forests, mangroves, plantations, parks and gardens in Malaysia, Singapore, Indonesia and Thailand.',
      wiki: 'Plantain squirrel', move: 'scurry', speed: 165, hp: 1, size: 50,
      art: { t: 'quad', fur: '#5d4c3b', back: '#4b3d30', belly: '#b5622e', stripe: '#d8c89a', bodyL: 0.55, bodyH: 0.3, legL: 0.14, headL: 0.26, snout: 0.07, ear: 'round', earS: 0.08, tail: 'bushy', tailL: 0.75, tailC: '#55473a', tailUp: true } },

    // ---------- RAINFOREST ----------
    { id: 'lt_macaque', name: 'Long-tailed Macaque', sci: 'Macaca fascicularis', cls: 'Mammal', family: 'Cercopithecidae', familyCommon: 'Old World monkeys',
      region: 'rainforest', rarity: 'common', status: 'EN', w: { m: [4.7, 8.3], f: [2.5, 5.7] }, habitat: 'Secondary forest, mangroves and forest edge near settlements throughout Southeast Asia.',
      wiki: 'Macaca fascicularis', move: 'walk', speed: 125, hp: 2, size: 88, pauses: true,
      art: { t: 'quad', fur: '#86765a', back: '#6f604a', belly: '#b6a98e', face: '#c4978a', bodyL: 0.5, bodyH: 0.3, legL: 0.3, headL: 0.22, snout: 0.06, ear: 'round', earS: 0.06, tail: 'thin', tailL: 0.62, tailC: '#7a6a50', tailUp: true, primate: true } },
    { id: 'mouse_deer', name: 'Lesser Mouse-deer', sci: 'Tragulus kanchil', cls: 'Mammal', family: 'Tragulidae', familyCommon: 'Chevrotains',
      region: 'rainforest', rarity: 'uncommon', status: 'LC', w: [1.5, 2.5], habitat: 'Dense lowland forest undergrowth and thickets of Southeast Asia, including Singapore.',
      wiki: 'Lesser mouse-deer', move: 'run', speed: 160, hp: 1, size: 60, nocturnal: true, pauses: true,
      art: { t: 'quad', fur: '#8a5832', back: '#6e4526', belly: '#e0d2bb', throat: true, bodyL: 0.55, bodyH: 0.32, legL: 0.3, legW: 0.035, headL: 0.24, snout: 0.12, ear: 'round', earS: 0.07, tail: 'stub' } },
    { id: 'rhino_hornbill', name: 'Rhinoceros Hornbill', sci: 'Buceros rhinoceros', cls: 'Bird', family: 'Bucerotidae', familyCommon: 'Hornbills',
      region: 'rainforest', rarity: 'rare', status: 'VU', w: { m: [2.465, 2.96], f: [2.04, 2.33] }, habitat: 'Primary lowland and hill rainforest of the Malay Peninsula, Sumatra, Java and Borneo.',
      wiki: 'Rhinoceros hornbill', move: 'fly', speed: 115, hp: 1, size: 140, slowFlap: true,
      art: { t: 'bird', back: '#141518', belly: '#1a1b1e', head: '#141518', wing: '#18191c', tail: '#ebe7dc', tailBand: '#141518', tailL: 0.36, beak: '#e9b83f', beakL: 0.5, curve: 0.18, casque: '#cf4f2a', casqueUp: true, neck: 0.1 } },
    { id: 'op_hornbill', name: 'Oriental Pied Hornbill', sci: 'Anthracoceros albirostris', cls: 'Bird', family: 'Bucerotidae', familyCommon: 'Hornbills',
      region: 'rainforest', rarity: 'uncommon', status: 'LC', w: [0.6, 1.05], habitat: 'Forest edge, plantations and coastal woodland; recolonised Singapore from the 1990s.',
      wiki: 'Oriental pied hornbill', move: 'fly', speed: 135, hp: 1, size: 110, slowFlap: true,
      art: { t: 'bird', back: '#16171a', belly: '#e9e6dc', head: '#16171a', wing: '#1a1b1f', tail: '#16171a', tailTip: '#e9e6dc', tailL: 0.38, beak: '#e5d9a8', beakL: 0.42, curve: 0.18, casque: '#e5d9a8', casqueMark: '#222', neck: 0.08 } },
    { id: 'great_hornbill', name: 'Great Hornbill', sci: 'Buceros bicornis', cls: 'Bird', family: 'Bucerotidae', familyCommon: 'Hornbills',
      region: 'rainforest', rarity: 'legendary', status: 'VU', w: [2.0, 4.0], habitat: 'Tall evergreen and moist deciduous forest of India, the Himalayan foothills and Southeast Asia.',
      wiki: 'Great hornbill', move: 'fly', speed: 105, hp: 1, size: 156, slowFlap: true,
      art: { t: 'bird', back: '#141518', belly: '#e2d8b0', head: '#141518', throat: '#e2d8b0', wing: '#17181b', patch: '#e2d8b0', tail: '#ece8de', tailBand: '#141518', tailL: 0.38, beak: '#e4b649', beakL: 0.5, curve: 0.2, casque: '#e4b649', casqueFlat: true, neck: 0.14 } },
    { id: 'red_junglefowl', name: 'Red Junglefowl', sci: 'Gallus gallus', cls: 'Bird', family: 'Phasianidae', familyCommon: 'Pheasants and fowl',
      region: 'rainforest', rarity: 'common', status: 'LC', w: { m: [0.672, 1.45], f: [0.485, 1.05] }, habitat: 'Forest edge, scrub and bamboo thickets across South and Southeast Asia; ancestor of the domestic chicken.',
      wiki: 'Red junglefowl', move: 'walk', speed: 95, hp: 1, size: 72, pauses: true,
      art: { t: 'fowl', body: '#2a1f1b', hackle: '#cc6a2c', wing: '#7a3b22', tail: '#1d2a26', comb: '#b8302a', legs: '#6a6a6a' },
      artF: { body: '#7a5c3d', hackle: '#a7793f', wing: '#6b4f33', tail: '#5f4730', comb: '#9a4a3a', small: true } },
    { id: 'palm_civet', name: 'Common Palm Civet', sci: 'Paradoxurus hermaphroditus', cls: 'Mammal', family: 'Viverridae', familyCommon: 'Civets and genets',
      region: 'rainforest', rarity: 'uncommon', status: 'LC', w: [2.0, 5.0], habitat: 'Forest, plantations and suburbs of South and Southeast Asia; locally called musang.',
      wiki: 'Asian palm civet', move: 'walk', speed: 105, hp: 2, size: 94, nocturnal: true,
      art: { t: 'quad', fur: '#6a6458', back: '#555046', belly: '#8a8476', legs: '#1e1c1a', spots: '#3a3631', mask: true, bodyL: 0.55, bodyH: 0.24, legL: 0.18, headL: 0.22, snout: 0.12, ear: 'round', earS: 0.08, tail: 'thin', tailL: 0.55, tailC: '#2a2724', tailUp: true, tailThick: 0.07 } },
    { id: 'sunda_pangolin', name: 'Sunda Pangolin', sci: 'Manis javanica', cls: 'Mammal', family: 'Manidae', familyCommon: 'Pangolins',
      region: 'rainforest', rarity: 'legendary', status: 'CR', w: [2.0, 10.0], habitat: 'Primary and secondary forest, plantations and gardens of Southeast Asia; still present in Singapore.',
      wiki: 'Sunda pangolin', move: 'walk', speed: 48, hp: 2, size: 96, nocturnal: true,
      art: { t: 'quad', fur: '#8a6a44', back: '#6e5434', belly: '#b9a284', scales: true, bodyL: 0.55, bodyH: 0.3, legL: 0.12, headL: 0.18, snout: 0.12, ear: 'none', tail: 'thick', tailL: 0.75, tailC: '#7d603d', arch: 0.12 } },
    { id: 'bt_bee_eater', name: 'Blue-throated Bee-eater', sci: 'Merops viridis', cls: 'Bird', family: 'Meropidae', familyCommon: 'Bee-eaters',
      region: 'rainforest', rarity: 'uncommon', status: 'LC', w: [0.034, 0.041], habitat: 'Open forest edge, coasts and parks of Southeast Asia; a breeding visitor to Singapore.',
      wiki: 'Blue-throated bee-eater', move: 'flit', speed: 230, hp: 1, size: 54,
      art: { t: 'bird', back: '#3f8a5b', belly: '#76b48f', head: '#7a3b22', throat: '#4c8fc2', wing: '#3b7f54', tail: '#3c7a6a', tailL: 0.85, streamer: true, beak: '#151515', beakL: 0.36, curve: 0.2, mask: '#111' } },
    { id: 'malayan_tapir', name: 'Malayan Tapir', sci: 'Tapirus indicus', cls: 'Mammal', family: 'Tapiridae', familyCommon: 'Tapirs',
      region: 'rainforest', rarity: 'legendary', status: 'EN', w: [250, 320], habitat: 'Swampy lowland and montane rainforest of the Malay Peninsula and Sumatra.',
      wiki: 'Malayan tapir', move: 'walk', speed: 62, hp: 3, size: 196, nocturnal: true,
      art: { t: 'quad', fur: '#18181a', back: '#18181a', belly: '#18181a', saddle: '#e5e1d6', bodyL: 0.6, bodyH: 0.36, legL: 0.2, legW: 0.06, headL: 0.22, snout: 0.12, trunk: true, ear: 'round', earS: 0.06, earRim: '#e5e1d6', tail: 'stub' } },
    { id: 'binturong', name: 'Binturong', sci: 'Arctictis binturong', cls: 'Mammal', family: 'Viverridae', familyCommon: 'Civets and genets',
      region: 'rainforest', rarity: 'rare', status: 'VU', w: [9, 20], habitat: 'Tall primary forest canopy of South and Southeast Asia; also called the bearcat.',
      wiki: 'Binturong', move: 'walk', speed: 58, hp: 2, size: 112, nocturnal: true,
      art: { t: 'quad', fur: '#1d1c1b', back: '#151414', belly: '#2a2826', frost: '#7d776c', bodyL: 0.52, bodyH: 0.3, legL: 0.16, headL: 0.22, snout: 0.08, ear: 'tuft', earS: 0.08, tail: 'bushy', tailL: 0.62, tailC: '#1a1918', tailThick: 0.09 } },

    // ---------- MANGROVE ----------
    { id: 'collared_kingfisher', name: 'Collared Kingfisher', sci: 'Todiramphus chloris', cls: 'Bird', family: 'Alcedinidae', familyCommon: 'Kingfishers',
      region: 'mangrove', rarity: 'common', status: 'LC', w: { m: [0.051, 0.09], f: [0.054, 0.1] }, habitat: 'Mangroves, coasts, parks and farmland from the Red Sea to Polynesia; common in Singapore.',
      wiki: 'Collared kingfisher', move: 'fly', speed: 215, hp: 1, size: 58,
      art: { t: 'bird', back: '#3c8ea4', belly: '#efece4', head: '#3c8ea4', collar2: '#efece4', wing: '#3f86a6', tail: '#3b7fa0', tailL: 0.3, beak: '#1a1a1a', beakL: 0.42, beakDeep: true, mask: '#16303a' } },
    { id: 'common_kingfisher', name: 'Common Kingfisher', sci: 'Alcedo atthis', cls: 'Bird', family: 'Alcedinidae', familyCommon: 'Kingfishers',
      region: 'mangrove', rarity: 'uncommon', status: 'LC', w: [0.034, 0.046], habitat: 'Slow rivers, streams, ponds and mangroves across Eurasia and North Africa.',
      wiki: 'Common kingfisher', move: 'flit', speed: 245, hp: 1, size: 44,
      art: { t: 'bird', back: '#2f8fbf', belly: '#d4793a', head: '#2c7fb0', throat: '#f0e8d8', wing: '#2a7aa8', tail: '#2a6fa0', tailL: 0.22, beak: '#1a1a1a', beakL: 0.45, beakDeep: true, mask: '#d4793a' } },
    { id: 'grey_heron', name: 'Grey Heron', sci: 'Ardea cinerea', cls: 'Bird', family: 'Ardeidae', familyCommon: 'Herons and egrets',
      region: 'mangrove', rarity: 'uncommon', status: 'LC', w: [1.0, 2.0], habitat: 'Wetlands, estuaries, mangroves and lake shores across Europe, Asia and Africa.',
      wiki: 'Grey heron', move: 'fly', speed: 105, hp: 1, size: 124, slowFlap: true,
      art: { t: 'bird', heron: true, back: '#8b9298', belly: '#d9d9d4', head: '#e7e6e1', wing: '#7b8389', wingTip: '#2a2d31', tail: '#80878d', tailL: 0.2, beak: '#d2b247', beakL: 0.45, legsTrail: '#b49c58', crestTip: '#1a1a1a', neck: 0.18 } },
    { id: 'sc_otter', name: 'Smooth-coated Otter', sci: 'Lutrogale perspicillata', cls: 'Mammal', family: 'Mustelidae', familyCommon: 'Weasels, otters and badgers',
      region: 'mangrove', rarity: 'rare', status: 'VU', w: [7, 11], habitat: 'Rivers, mangroves and coasts of South and Southeast Asia; famous family groups roam Singapore.',
      wiki: 'Smooth-coated otter', move: 'run', speed: 135, hp: 2, size: 104,
      art: { t: 'quad', fur: '#5d4532', back: '#4b3727', belly: '#9b8468', bodyL: 0.6, bodyH: 0.22, legL: 0.1, legW: 0.05, headL: 0.18, snout: 0.06, ear: 'round', earS: 0.04, tail: 'thick', tailL: 0.5, tailC: '#523d2c', glossy: true } },
    { id: 'water_monitor', name: 'Asian Water Monitor', sci: 'Varanus salvator', cls: 'Reptile', family: 'Varanidae', familyCommon: 'Monitor lizards',
      region: 'mangrove', rarity: 'uncommon', status: 'LC', w: [2, 32], habitat: 'Mangroves, rivers, swamps and urban canals across South and Southeast Asia.',
      wiki: 'Asian water monitor', move: 'walk', speed: 72, hp: 2, size: 156,
      art: { t: 'lizard', fur: '#2f3427', back: '#262a20', belly: '#6e6a4c', spots: '#b8a95a' } },
    { id: 'brahminy_kite', name: 'Brahminy Kite', sci: 'Haliastur indus', cls: 'Bird', family: 'Accipitridae', familyCommon: 'Hawks, kites and eagles',
      region: 'mangrove', rarity: 'common', status: 'LC', w: [0.32, 0.673], habitat: 'Coasts, estuaries, mangroves and inland wetlands from India to Australia.',
      wiki: 'Brahminy kite', move: 'soar', speed: 110, hp: 1, size: 112,
      art: { t: 'raptor', back: '#9b4a27', belly: '#a35128', head: '#ebe5d8', wing: '#8f4322', wingTip: '#2a1a12', tail: '#a0532c', beak: '#d9cf8a' } },
    { id: 'wb_sea_eagle', name: 'White-bellied Sea Eagle', sci: 'Haliaeetus leucogaster', cls: 'Bird', family: 'Accipitridae', familyCommon: 'Hawks, kites and eagles',
      region: 'mangrove', rarity: 'rare', status: 'LC', w: { m: [1.8, 3.0], f: [2.5, 4.5] }, habitat: 'Coasts, islands and large rivers from India through Southeast Asia to Australia.',
      wiki: 'White-bellied sea eagle', move: 'soar', speed: 95, hp: 1, size: 144,
      art: { t: 'raptor', back: '#5b5f63', belly: '#efece6', head: '#efece6', wing: '#5b5f63', wingTip: '#1c1d1f', under: '#efece6', tail: '#efece6', beak: '#8a8a8a' } },

    // ---------- HIGHLANDS & PLAINS ----------
    { id: 'red_kangaroo', name: 'Red Kangaroo', sci: 'Osphranter rufus', cls: 'Mammal', family: 'Macropodidae', familyCommon: 'Kangaroos and wallabies',
      region: 'highlands', rarity: 'uncommon', status: 'LC', w: { m: [55, 90], f: [18, 40] }, habitat: 'Arid and semi-arid grassland and shrubland of mainland Australia.',
      wiki: 'Red kangaroo', move: 'roo', speed: 225, hp: 3, size: 132,
      art: { t: 'roo', fur: '#a8522f', back: '#8f4425', belly: '#e3d5c2', muzzle: '#e8ddd0' },
      artF: { fur: '#8b8f96', back: '#757980', belly: '#d9d8d4' } },
    { id: 'peregrine', name: 'Peregrine Falcon', sci: 'Falco peregrinus', cls: 'Bird', family: 'Falconidae', familyCommon: 'Falcons',
      region: 'highlands', rarity: 'rare', status: 'LC', w: { m: [0.33, 1.0], f: [0.7, 1.5] }, habitat: 'Cliffs, coasts, mountains and city skyscrapers on every continent except Antarctica.',
      wiki: 'Peregrine falcon', move: 'dive', speed: 300, hp: 1, size: 92,
      art: { t: 'raptor', narrow: true, back: '#4f5967', belly: '#e6e2d8', bars: '#3a3f47', head: '#1f2227', wing: '#4a5462', wingTip: '#2a2f36', tail: '#46505c', beak: '#e0c34a' } },
    { id: 'gh_owl', name: 'Great Horned Owl', sci: 'Bubo virginianus', cls: 'Bird', family: 'Strigidae', familyCommon: 'True owls',
      region: 'highlands', rarity: 'uncommon', status: 'LC', w: { m: [0.68, 1.59], f: [0.83, 2.5] }, habitat: 'Forests, deserts, grassland and suburbs across the Americas.',
      wiki: 'Great horned owl', move: 'fly', speed: 120, hp: 1, size: 96, nocturnal: true,
      art: { t: 'owl', back: '#6e5841', belly: '#a58d6c', disc: '#b39470', wing: '#5f4b37', bars: '#3e3124', tail: '#5f4b37', beak: '#3a3a3a', eye: '#e8b63a' } },
    { id: 'bald_eagle', name: 'Bald Eagle', sci: 'Haliaeetus leucocephalus', cls: 'Bird', family: 'Accipitridae', familyCommon: 'Hawks, kites and eagles',
      region: 'highlands', rarity: 'rare', status: 'LC', w: [3.0, 6.3], habitat: 'Lakes, rivers and coasts with tall trees across North America.',
      wiki: 'Bald eagle', move: 'soar', speed: 92, hp: 1, size: 154,
      art: { t: 'raptor', back: '#3a2a1e', belly: '#3a2a1e', head: '#f0ede6', wing: '#35261b', wingTip: '#1c140e', tail: '#f0ede6', beak: '#e6b83a' } },
    { id: 'wild_boar', name: 'Wild Boar', sci: 'Sus scrofa', cls: 'Mammal', family: 'Suidae', familyCommon: 'Pigs and hogs',
      region: 'highlands', rarity: 'common', status: 'LC', w: { m: [50, 130], f: [45, 95] }, habitat: 'Forest, scrub and farmland across Eurasia and North Africa; introduced elsewhere.',
      wiki: 'Wild boar', move: 'run', speed: 160, hp: 3, size: 140,
      art: { t: 'quad', fur: '#3f3630', back: '#2e2723', belly: '#5a4e45', bristle: true, bodyL: 0.62, bodyH: 0.4, legL: 0.16, legW: 0.05, headL: 0.26, snout: 0.14, pig: true, ear: 'point', earS: 0.08, tail: 'thin', tailL: 0.15, tailC: '#2e2723', hump: 0.08 } },
    { id: 'sambar', name: 'Sambar', sci: 'Rusa unicolor', cls: 'Mammal', family: 'Cervidae', familyCommon: 'Deer',
      region: 'highlands', rarity: 'rare', status: 'VU', w: [100, 350], habitat: 'Hill and lowland forest of the Indian subcontinent, South China and Southeast Asia.',
      wiki: 'Sambar deer', move: 'run', speed: 145, hp: 3, size: 172, nocturnal: true,
      art: { t: 'quad', fur: '#5a4333', back: '#47342a', belly: '#7a6450', bodyL: 0.55, bodyH: 0.3, legL: 0.36, legW: 0.035, headL: 0.22, snout: 0.12, neck: 0.18, ear: 'point', earS: 0.09, tail: 'thin', tailL: 0.12, tailC: '#2a201a', antlers: true } },
  ];

  const RARITY = {
    common: { label: 'Common', xp: 15, coins: 4, weight: 60, color: '#9aa58a' },
    uncommon: { label: 'Uncommon', xp: 30, coins: 8, weight: 28, color: '#7fa7b8' },
    rare: { label: 'Rare', xp: 60, coins: 16, weight: 10, color: '#c8a25a' },
    legendary: { label: 'Exceptional', xp: 150, coins: 40, weight: 3, color: '#d0866a' },
  };
  const STATUS = {
    LC: { label: 'Least Concern', color: '#6f9a6a' }, NT: { label: 'Near Threatened', color: '#9fae5a' },
    VU: { label: 'Vulnerable', color: '#d2a843' }, EN: { label: 'Endangered', color: '#d07a42' },
    CR: { label: 'Critically Endangered', color: '#c94a3a' },
  };
  const THREATENED = ['VU', 'EN', 'CR'];

  function weightRange(sp, gender) {
    if (Array.isArray(sp.w)) return sp.w;
    return gender === 'female' ? sp.w.f : sp.w.m;
  }
  function overallRange(sp) {
    if (Array.isArray(sp.w)) return sp.w;
    return [Math.min(sp.w.m[0], sp.w.f[0]), Math.max(sp.w.m[1], sp.w.f[1])];
  }
  // Individual traits from an rng (deterministic in VS)
  function makeIndividual(sp, rng) {
    const gender = rng() < 0.5 ? 'male' : 'female';
    const [a, b] = weightRange(sp, gender);
    // triangular-ish distribution: most individuals near the middle of the range
    const u = (rng() + rng()) / 2;
    const weight = a + (b - a) * u;
    return { gender, weight: Math.round(weight * (weight < 1 ? 1000 : 100)) / (weight < 1 ? 1000 : 100) };
  }
  function fmtWeight(kg) {
    if (kg < 1) return Math.round(kg * 1000) + ' g';
    if (kg < 100) return kg.toFixed(2) + ' kg';
    return Math.round(kg) + ' kg';
  }
  function fmtRange(sp) {
    if (Array.isArray(sp.w)) return fmtWeight(sp.w[0]) + ' – ' + fmtWeight(sp.w[1]);
    return '♂ ' + fmtWeight(sp.w.m[0]) + '–' + fmtWeight(sp.w.m[1]) + ' · ♀ ' + fmtWeight(sp.w.f[0]) + '–' + fmtWeight(sp.w.f[1]);
  }

  const byId = {};
  S.forEach((s, i) => { s.index = i; byId[s.id] = s; });

  window.SPECIES = S;
  window.SpeciesDB = { REGIONS, RARITY, STATUS, THREATENED, byId, weightRange, overallRange, makeIndividual, fmtWeight, fmtRange,
    region: id => REGIONS.find(r => r.id === id),
    inRegion: id => S.filter(s => s.region === id) };
})();
