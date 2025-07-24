/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/capsulex.json`.
 */
export type Capsulex = {
  "address": "J1r7tHjxEuCcSYVrikUKxzyeeccuC3QbyHjUbY8Pw7uH",
  "metadata": {
    "name": "capsulex",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "completeGame",
      "discriminator": [
        105,
        69,
        184,
        5,
        143,
        182,
        92,
        132
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "game",
          "writable": true
        },
        {
          "name": "capsule"
        },
        {
          "name": "creatorLeaderboard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  100,
                  101,
                  114,
                  98,
                  111,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "game.creator",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createCapsule",
      "discriminator": [
        195,
        104,
        42,
        180,
        127,
        169,
        62,
        3
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "capsule",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  112,
                  115,
                  117,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "revealDate"
              }
            ]
          }
        },
        {
          "name": "nftMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  112,
                  115,
                  117,
                  108,
                  101,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "capsule"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "game",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "encryptedContent",
          "type": "string"
        },
        {
          "name": "contentStorage",
          "type": {
            "defined": {
              "name": "contentStorage"
            }
          }
        },
        {
          "name": "contentIntegrityHash",
          "type": "string"
        },
        {
          "name": "revealDate",
          "type": "i64"
        },
        {
          "name": "isGamified",
          "type": "bool"
        }
      ]
    },
    {
      "name": "initializeGame",
      "discriminator": [
        44,
        62,
        102,
        247,
        126,
        208,
        130,
        215
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "capsule"
        },
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "capsule"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "capsuleId",
          "type": "pubkey"
        },
        {
          "name": "maxGuesses",
          "type": "u32"
        },
        {
          "name": "maxWinners",
          "type": "u32"
        }
      ]
    },
    {
      "name": "initializeLeaderboard",
      "discriminator": [
        47,
        23,
        34,
        39,
        46,
        108,
        91,
        176
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "user"
        },
        {
          "name": "leaderboard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  100,
                  101,
                  114,
                  98,
                  111,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "user",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initializeProgram",
      "discriminator": [
        176,
        107,
        205,
        168,
        24,
        157,
        175,
        103
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "mintCapsuleNft",
      "discriminator": [
        157,
        233,
        60,
        113,
        103,
        186,
        247,
        209
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "capsule",
          "writable": true
        },
        {
          "name": "nftMint",
          "writable": true
        },
        {
          "name": "creatorTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "nftMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "uri",
          "type": "string"
        }
      ]
    },
    {
      "name": "mintTrophyNft",
      "discriminator": [
        53,
        65,
        131,
        97,
        82,
        246,
        31,
        167
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "user",
          "writable": true
        },
        {
          "name": "leaderboard"
        },
        {
          "name": "trophyMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  111,
                  112,
                  104,
                  121,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "arg",
                "path": "trophyType"
              }
            ]
          }
        },
        {
          "name": "userTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "trophyMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "trophyType",
          "type": "string"
        },
        {
          "name": "metadataUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "mintWinnerBadge",
      "discriminator": [
        181,
        60,
        45,
        164,
        157,
        254,
        89,
        89
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "winner",
          "writable": true
        },
        {
          "name": "game"
        },
        {
          "name": "badgeMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  100,
                  103,
                  101,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "game"
              },
              {
                "kind": "account",
                "path": "winner"
              }
            ]
          }
        },
        {
          "name": "winnerTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "winner"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "badgeMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "badgeType",
          "type": "string"
        },
        {
          "name": "metadataUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "revealCapsule",
      "discriminator": [
        217,
        13,
        28,
        128,
        0,
        255,
        1,
        167
      ],
      "accounts": [
        {
          "name": "revealer",
          "writable": true,
          "signer": true
        },
        {
          "name": "capsule",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  112,
                  115,
                  117,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "capsule.creator",
                "account": "capsule"
              },
              {
                "kind": "arg",
                "path": "revealDate"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "revealDate",
          "type": "i64"
        }
      ]
    },
    {
      "name": "submitGuess",
      "discriminator": [
        61,
        124,
        32,
        227,
        64,
        198,
        252,
        3
      ],
      "accounts": [
        {
          "name": "guesser",
          "writable": true,
          "signer": true
        },
        {
          "name": "game",
          "writable": true
        },
        {
          "name": "guess",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  117,
                  101,
                  115,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "game"
              },
              {
                "kind": "account",
                "path": "guesser"
              },
              {
                "kind": "account",
                "path": "game.current_guesses",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "guessContent",
          "type": "string"
        },
        {
          "name": "isAnonymous",
          "type": "bool"
        }
      ]
    },
    {
      "name": "updateLeaderboard",
      "discriminator": [
        72,
        95,
        102,
        32,
        118,
        158,
        247,
        34
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "user"
        },
        {
          "name": "leaderboard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  100,
                  101,
                  114,
                  98,
                  111,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "user",
          "type": "pubkey"
        },
        {
          "name": "points",
          "type": "u64"
        }
      ]
    },
    {
      "name": "verifyGuess",
      "discriminator": [
        45,
        170,
        104,
        146,
        146,
        102,
        230,
        104
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "guess",
          "writable": true
        },
        {
          "name": "game",
          "writable": true
        },
        {
          "name": "capsule"
        },
        {
          "name": "leaderboard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  97,
                  100,
                  101,
                  114,
                  98,
                  111,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "guess.guesser",
                "account": "guess"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "decryptedContent",
          "type": "string"
        },
        {
          "name": "verificationWindowHours",
          "type": {
            "option": "u8"
          }
        },
        {
          "name": "semanticResult",
          "type": "bool"
        },
        {
          "name": "oracleTimestamp",
          "type": "i64"
        },
        {
          "name": "oracleNonce",
          "type": "string"
        },
        {
          "name": "oracleSignature",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "capsule",
      "discriminator": [
        212,
        231,
        77,
        219,
        58,
        13,
        118,
        241
      ]
    },
    {
      "name": "game",
      "discriminator": [
        27,
        90,
        166,
        125,
        74,
        100,
        121,
        18
      ]
    },
    {
      "name": "guess",
      "discriminator": [
        199,
        136,
        162,
        22,
        201,
        176,
        249,
        195
      ]
    },
    {
      "name": "leaderboardEntry",
      "discriminator": [
        187,
        21,
        182,
        152,
        7,
        55,
        20,
        16
      ]
    },
    {
      "name": "programVault",
      "discriminator": [
        19,
        247,
        127,
        147,
        186,
        67,
        82,
        61
      ]
    }
  ],
  "events": [
    {
      "name": "capsuleCreated",
      "discriminator": [
        113,
        132,
        247,
        198,
        217,
        47,
        201,
        223
      ]
    },
    {
      "name": "capsuleNftMinted",
      "discriminator": [
        39,
        86,
        188,
        158,
        25,
        167,
        138,
        63
      ]
    },
    {
      "name": "capsuleRevealed",
      "discriminator": [
        38,
        218,
        116,
        91,
        16,
        17,
        230,
        195
      ]
    },
    {
      "name": "gameCompleted",
      "discriminator": [
        103,
        26,
        106,
        108,
        240,
        191,
        179,
        120
      ]
    },
    {
      "name": "gameInitialized",
      "discriminator": [
        82,
        221,
        11,
        2,
        244,
        52,
        240,
        250
      ]
    },
    {
      "name": "guessSubmitted",
      "discriminator": [
        9,
        204,
        248,
        63,
        138,
        8,
        159,
        123
      ]
    },
    {
      "name": "leaderboardInitialized",
      "discriminator": [
        135,
        70,
        99,
        96,
        246,
        187,
        226,
        226
      ]
    },
    {
      "name": "leaderboardUpdated",
      "discriminator": [
        28,
        209,
        133,
        1,
        229,
        195,
        230,
        228
      ]
    },
    {
      "name": "pointsAwarded",
      "discriminator": [
        201,
        95,
        152,
        50,
        215,
        83,
        188,
        38
      ]
    },
    {
      "name": "programInitialized",
      "discriminator": [
        43,
        70,
        110,
        241,
        199,
        218,
        221,
        245
      ]
    },
    {
      "name": "trophyNftMinted",
      "discriminator": [
        90,
        139,
        171,
        205,
        108,
        106,
        108,
        88
      ]
    },
    {
      "name": "winnerBadgeMinted",
      "discriminator": [
        145,
        113,
        233,
        144,
        51,
        59,
        168,
        32
      ]
    },
    {
      "name": "winnerFound",
      "discriminator": [
        21,
        176,
        140,
        230,
        243,
        252,
        250,
        172
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidRevealDate",
      "msg": "Invalid reveal date. Must be between 1 hour and 1 year from now."
    },
    {
      "code": 6001,
      "name": "contentHashTooLong",
      "msg": "Content hash is too long. Maximum length is 280 characters."
    },
    {
      "code": 6002,
      "name": "capsuleNotReady",
      "msg": "Capsule is not yet ready to be revealed."
    },
    {
      "code": 6003,
      "name": "capsuleAlreadyRevealed",
      "msg": "Capsule has already been revealed."
    },
    {
      "code": 6004,
      "name": "capsuleNotActive",
      "msg": "Capsule is not active."
    },
    {
      "code": 6005,
      "name": "unauthorizedCreator",
      "msg": "Only the capsule creator can perform this action."
    },
    {
      "code": 6006,
      "name": "unauthorizedRevealer",
      "msg": "Only the capsule creator or app authority can reveal this capsule."
    },
    {
      "code": 6007,
      "name": "gameNotActive",
      "msg": "Game is not active."
    },
    {
      "code": 6008,
      "name": "maxGuessesReached",
      "msg": "Maximum number of guesses reached for this game."
    },
    {
      "code": 6009,
      "name": "guessContentTooLong",
      "msg": "Guess content is too long. Maximum length is 280 characters."
    },
    {
      "code": 6010,
      "name": "insufficientFunds",
      "msg": "Insufficient funds for paid guess."
    },
    {
      "code": 6011,
      "name": "winnerAlreadyFound",
      "msg": "Winner has already been found for this game."
    },
    {
      "code": 6012,
      "name": "incorrectGuess",
      "msg": "Guess is not correct."
    },
    {
      "code": 6013,
      "name": "rewardsAlreadyDistributed",
      "msg": "Rewards have already been distributed."
    },
    {
      "code": 6014,
      "name": "noFeesToDistribute",
      "msg": "No fees collected to distribute."
    },
    {
      "code": 6015,
      "name": "metadataUriTooLong",
      "msg": "Metadata URI is too long. Maximum length is 200 characters."
    },
    {
      "code": 6016,
      "name": "badgeTypeTooLong",
      "msg": "Badge type is too long. Maximum length is 32 characters."
    },
    {
      "code": 6017,
      "name": "invalidFeeAmount",
      "msg": "Invalid fee amount."
    },
    {
      "code": 6018,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow occurred."
    },
    {
      "code": 6019,
      "name": "invalidPercentage",
      "msg": "Invalid percentage. Must be between 0 and 100."
    },
    {
      "code": 6020,
      "name": "gameNotEnded",
      "msg": "Game has not ended yet."
    },
    {
      "code": 6021,
      "name": "notEligibleForReward",
      "msg": "User is not eligible for this reward."
    },
    {
      "code": 6022,
      "name": "nftMintFailed",
      "msg": "NFT mint failed."
    },
    {
      "code": 6023,
      "name": "tokenAccountCreationFailed",
      "msg": "Token account creation failed."
    },
    {
      "code": 6024,
      "name": "invalidAccountOwner",
      "msg": "Invalid account owner."
    },
    {
      "code": 6025,
      "name": "accountNotInitialized",
      "msg": "Account is not initialized."
    },
    {
      "code": 6026,
      "name": "invalidProgramAuthority",
      "msg": "Invalid program authority."
    },
    {
      "code": 6027,
      "name": "clockNotAvailable",
      "msg": "Clock not available."
    },
    {
      "code": 6028,
      "name": "invalidSystemProgram",
      "msg": "Invalid system program."
    },
    {
      "code": 6029,
      "name": "invalidTokenProgram",
      "msg": "Invalid token program."
    },
    {
      "code": 6030,
      "name": "invalidAssociatedTokenProgram",
      "msg": "Invalid associated token program."
    },
    {
      "code": 6031,
      "name": "invalidMetadataProgram",
      "msg": "Invalid metadata program."
    },
    {
      "code": 6032,
      "name": "capsuleNotGamified",
      "msg": "Capsule is not gamified."
    },
    {
      "code": 6033,
      "name": "onlyPaidGuessesEligible",
      "msg": "Only paid guesses are eligible for rewards."
    },
    {
      "code": 6034,
      "name": "invalidGuessId",
      "msg": "Invalid guess ID."
    },
    {
      "code": 6035,
      "name": "leaderboardEntryExists",
      "msg": "User already has a leaderboard entry."
    },
    {
      "code": 6036,
      "name": "leaderboardEntryNotFound",
      "msg": "Leaderboard entry not found."
    },
    {
      "code": 6037,
      "name": "invalidOracleSignature",
      "msg": "Invalid oracle signature."
    },
    {
      "code": 6038,
      "name": "oracleSignatureExpired",
      "msg": "Oracle signature has expired."
    },
    {
      "code": 6039,
      "name": "invalidCid",
      "msg": "Invalid IPFS CID format."
    },
    {
      "code": 6040,
      "name": "invalidUrl",
      "msg": "Invalid URL format."
    },
    {
      "code": 6041,
      "name": "unsupportedPlatform",
      "msg": "Unsupported social media platform."
    },
    {
      "code": 6042,
      "name": "invalidContentHash",
      "msg": "Invalid content integrity hash."
    },
    {
      "code": 6043,
      "name": "tooManyAttachments",
      "msg": "Too many attachments. Maximum is 50."
    },
    {
      "code": 6044,
      "name": "contentTooLarge",
      "msg": "Content is too large. Maximum is 1GB."
    },
    {
      "code": 6045,
      "name": "invalidGameAccount",
      "msg": "Invalid game account provided."
    }
  ],
  "types": [
    {
      "name": "capsule",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "nftMint",
            "type": "pubkey"
          },
          {
            "name": "encryptedContent",
            "type": "string"
          },
          {
            "name": "contentStorage",
            "type": {
              "defined": {
                "name": "contentStorage"
              }
            }
          },
          {
            "name": "contentIntegrityHash",
            "type": "string"
          },
          {
            "name": "revealDate",
            "type": "i64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "isGamified",
            "type": "bool"
          },
          {
            "name": "isRevealed",
            "type": "bool"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "capsuleCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "capsuleId",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "nftMint",
            "type": "pubkey"
          },
          {
            "name": "revealDate",
            "type": "i64"
          },
          {
            "name": "isGamified",
            "type": "bool"
          },
          {
            "name": "contentStorage",
            "type": {
              "defined": {
                "name": "contentStorage"
              }
            }
          },
          {
            "name": "feeAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "capsuleNftMinted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "capsuleId",
            "type": "pubkey"
          },
          {
            "name": "nftMint",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "symbol",
            "type": "string"
          },
          {
            "name": "uri",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "capsuleRevealed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "capsuleId",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "revealer",
            "type": "pubkey"
          },
          {
            "name": "revealTime",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "contentStorage",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "text"
          },
          {
            "name": "document",
            "fields": [
              {
                "name": "cid",
                "type": "string"
              }
            ]
          },
          {
            "name": "socialArchive",
            "fields": [
              {
                "name": "originalUrl",
                "type": "string"
              },
              {
                "name": "archivedCid",
                "type": "string"
              },
              {
                "name": "platform",
                "type": "string"
              },
              {
                "name": "captureTimestamp",
                "type": "i64"
              },
              {
                "name": "contentHash",
                "type": "string"
              }
            ]
          },
          {
            "name": "mediaBundle",
            "fields": [
              {
                "name": "primaryCid",
                "type": "string"
              },
              {
                "name": "attachments",
                "type": {
                  "vec": "string"
                }
              },
              {
                "name": "manifestCid",
                "type": "string"
              },
              {
                "name": "totalSizeBytes",
                "type": "u64"
              }
            ]
          },
          {
            "name": "externalWithBackup",
            "fields": [
              {
                "name": "originalUrl",
                "type": "string"
              },
              {
                "name": "backupCid",
                "type": "string"
              },
              {
                "name": "verificationHash",
                "type": "string"
              }
            ]
          }
        ]
      }
    },
    {
      "name": "game",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "capsuleId",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "maxGuesses",
            "type": "u32"
          },
          {
            "name": "maxWinners",
            "type": "u32"
          },
          {
            "name": "currentGuesses",
            "type": "u32"
          },
          {
            "name": "winnersFound",
            "type": "u32"
          },
          {
            "name": "totalParticipants",
            "type": "u32"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "winnerFound",
            "type": "bool"
          },
          {
            "name": "winner",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "winners",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "gameCompleted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gameId",
            "type": "pubkey"
          },
          {
            "name": "totalParticipants",
            "type": "u32"
          },
          {
            "name": "winnerFound",
            "type": "bool"
          },
          {
            "name": "winner",
            "type": {
              "option": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "gameInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gameId",
            "type": "pubkey"
          },
          {
            "name": "capsuleId",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "maxGuesses",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "guess",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gameId",
            "type": "pubkey"
          },
          {
            "name": "guesser",
            "type": "pubkey"
          },
          {
            "name": "guessContent",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "isPaid",
            "type": "bool"
          },
          {
            "name": "isCorrect",
            "type": "bool"
          },
          {
            "name": "isAnonymous",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "guessSubmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "guessId",
            "type": "pubkey"
          },
          {
            "name": "gameId",
            "type": "pubkey"
          },
          {
            "name": "guesser",
            "type": "pubkey"
          },
          {
            "name": "guessContent",
            "type": "string"
          },
          {
            "name": "isPaid",
            "type": "bool"
          },
          {
            "name": "isAnonymous",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "leaderboardEntry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "totalPoints",
            "type": "u64"
          },
          {
            "name": "gamesWon",
            "type": "u32"
          },
          {
            "name": "gamesPlayed",
            "type": "u32"
          },
          {
            "name": "capsulesCreated",
            "type": "u32"
          },
          {
            "name": "totalRewardsEarned",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "leaderboardInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "leaderboardId",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "leaderboardUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "pointsAdded",
            "type": "u64"
          },
          {
            "name": "totalPoints",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "pointsAwarded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "gameId",
            "type": "pubkey"
          },
          {
            "name": "points",
            "type": "u64"
          },
          {
            "name": "reason",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "programInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "programVault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "totalFeesCollected",
            "type": "u64"
          },
          {
            "name": "totalRewardsDistributed",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "trophyNftMinted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "trophyMint",
            "type": "pubkey"
          },
          {
            "name": "trophyType",
            "type": "string"
          },
          {
            "name": "metadataUri",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "winnerBadgeMinted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gameId",
            "type": "pubkey"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "badgeMint",
            "type": "pubkey"
          },
          {
            "name": "badgeType",
            "type": "string"
          },
          {
            "name": "metadataUri",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "winnerFound",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "gameId",
            "type": "pubkey"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "guessId",
            "type": "pubkey"
          },
          {
            "name": "winningGuess",
            "type": "string"
          }
        ]
      }
    }
  ]
};
