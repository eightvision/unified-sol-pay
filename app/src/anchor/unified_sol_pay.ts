/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/unified_sol_pay.json`.
 */
export type UnifiedSolPay = {
  "address": "8RDNyCPjurbhbN9X4RmyZTrbhDWYU6ZcjVKMiC6VujkN",
  "metadata": {
    "name": "unifiedSolPay",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "payToHandle",
      "docs": [
        "Resolves `handle` through the registry PDA and pays `amount` lamports",
        "to the wallet holding that handle.",
        "Program re-verifies: (b) the record address IS the canonical PDA of the",
        "stated `handle`, and (c) recipient == record.authority — so redirects",
        "fail on-chain instead of silently redirecting funds."
      ],
      "discriminator": [
        46,
        63,
        52,
        225,
        102,
        69,
        232,
        116
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Sender of the payment."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "recipient",
          "docs": [
            "recipient == handle_record.authority (UpiError::NotRecipient),",
            "so a wrong destination fails at program level instead of transferring."
          ],
          "writable": true
        },
        {
          "name": "handleRecord",
          "docs": [
            "Registry PDA for the handle being paid; canonicality re-checked in-handler."
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "handle",
          "type": "string"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "registerHandle",
      "docs": [
        "Registers `handle` to the caller's wallet.",
        "Fails if the handle PDA already exists (handle taken)."
      ],
      "discriminator": [
        15,
        173,
        21,
        158,
        125,
        204,
        221,
        29
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Wallet claiming the handle; also the rent payer."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "record",
          "docs": [
            "PDA for this handle: `seeds = [b\"upi\", <instruction arg: handle>]`.",
            "`init` guarantees the handle was free at registration."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  112,
                  105
                ]
              },
              {
                "kind": "arg",
                "path": "handle"
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
          "name": "handle",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "handleRecord",
      "discriminator": [
        207,
        77,
        153,
        227,
        208,
        212,
        140,
        254
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidLength",
      "msg": "Handle must be 1-32 characters"
    },
    {
      "code": 6001,
      "name": "invalidCharacters",
      "msg": "Handle may only contain a-z, 0-9, '.', '_' , '-' (no '@')"
    },
    {
      "code": 6002,
      "name": "notCanonical",
      "msg": "handle_record must be the registry PDA of the stated handle"
    },
    {
      "code": 6003,
      "name": "notRecipient",
      "msg": "Recipient is not the wallet holding this handle"
    }
  ],
  "types": [
    {
      "name": "handleRecord",
      "docs": [
        "HandleRecord maps a UPI-style handle (user part; suffix implied)",
        "to the wallet that owns it.",
        "PDA seeds = [`b\"upi\"`, handle] — the handle addresses the record, so any",
        "client can resolve `handle → authority` with pure derivation + one read."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "handle",
            "docs": [
              "Canonical registered handle (user part only, lowercase)."
            ],
            "type": "string"
          },
          {
            "name": "authority",
            "docs": [
              "Wallet address this handle pays to."
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp of registration."
            ],
            "type": "i64"
          }
        ]
      }
    }
  ]
};
