# Compensation Data Governance

## Overview
Compensation plans are stored as encrypted YAML files in `docs/private/comp/` using SOPS with age encryption. Only Eric can decrypt and view raw compensation data.

## Access Control
- **Decryption**: Only Eric's age private key can decrypt files
- **Editing**: Only Eric can edit encrypted files
- **Review**: Quarterly review of all compensation plans

## Usage
To decrypt files for viewing/editing:
```bash
export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt
sops -d docs/private/comp/{name}.yaml  # View
sops docs/private/comp/{name}.yaml     # Edit (opens in $EDITOR)
```

Files are automatically encrypted on save when using `sops` for editing.

## Key Management
- Age public key: `age1yt58hyslqsv69zk47vpvdmsany3a0cdhkmvhdcnwzh287g27nanqgktvlg`
- Private key stored in 1Password under "Liftoff Age Private Key"
- Key rotation: Quarterly, re-encrypt all files with new recipient

## Derived Signals
System uses `docs/operations/derived/comp-signals.json` for:
- Scale policy multipliers
- Spend cap hints
- Incentive structure types

## Security Measures
- Pre-commit hook blocks unencrypted comp file commits
- Files in `docs/private/comp/plaintext/` are gitignored
- Never commit plaintext compensation data

## Emergency Access
If Eric is unavailable, contact [emergency contact] for key recovery procedure.
