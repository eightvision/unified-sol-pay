use anchor_lang::prelude::*;

declare_id!("8RDNyCPjurbhbN9X4RmyZTrbhDWYU6ZcjVKMiC6VujkN");

/// Maximum length of a handle's user part (before the implicit `@solpay`).
pub const MAX_HANDLE_LEN: usize = 32;

/// HandleRecord maps a UPI-style handle (user part; suffix implied)
/// to the wallet that owns it.
/// PDA seeds = [`b"upi"`, handle] — the handle addresses the record, so any
/// client can resolve `handle → authority` with pure derivation + one read.
#[account]
pub struct HandleRecord {
    /// Canonical registered handle (user part only, lowercase).
    pub handle: String,
    /// Wallet address this handle pays to.
    pub authority: Pubkey,
    /// PDA bump.
    pub bump: u8,
    /// Unix timestamp of registration.
    pub created_at: i64,
}
/// 4 (String len prefix) + 32 (max handle) + 32 (authority) + 1 (bump) + 8 (ts)
pub const RECORD_USABLE_SPACE: usize = 4 + MAX_HANDLE_LEN + 32 + 1 + 8;
pub const RECORD_SPACE: usize = 8 + RECORD_USABLE_SPACE; // + 8-byte Anchor discriminator

#[error_code]
pub enum UpiError {
    #[msg("Handle must be 1-32 characters")]
    InvalidLength,
    #[msg("Handle may only contain a-z, 0-9, '.', '_' , '-' (no '@')")]
    InvalidCharacters,
    #[msg("handle_record must be the registry PDA of the stated handle")]
    NotCanonical,
    #[msg("Recipient is not the wallet holding this handle")]
    NotRecipient,
}

#[program]
pub mod unified_sol_pay {
    use super::*;

    /// Registers `handle` to the caller's wallet.
    /// Fails if the handle PDA already exists (handle taken).
    pub fn register_handle(ctx: Context<Register>, handle: String) -> Result<()> {
        validate_handle(&handle)?;
        let clock = Clock::get()?;
        let r = &mut ctx.accounts.record;
        r.handle = handle;
        r.authority = ctx.accounts.payer.key();
        r.bump = ctx.bumps.record;
        r.created_at = clock.unix_timestamp;
        Ok(())
    }

    /// Resolves `handle` through the registry PDA and pays `amount` lamports
    /// to the wallet holding that handle.
    /// Program re-verifies: (b) the record address IS the canonical PDA of the
    /// stated `handle`, and (c) recipient == record.authority — so redirects
    /// fail on-chain instead of silently redirecting funds.
    pub fn pay_to_handle(ctx: Context<PayToHandle>, handle: String, amount: u64) -> Result<()> {
        validate_handle(&handle)?;

        // (b) canonical PDA check — record must BE the registry entry of `handle`
        let (canonical, _bump) =
            Pubkey::find_program_address(&[b"upi", handle.as_bytes()], &crate::ID);
        require!(ctx.accounts.handle_record.key() == canonical, UpiError::NotCanonical);
        // (c) recipient enforcement
        require!(
            ctx.accounts.recipient.key() == ctx.accounts.handle_record.authority,
            UpiError::NotRecipient
        );

        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.recipient.to_account_info(),
                },
            ),
            amount,
        )?;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(handle: String)]
pub struct Register<'info> {
    /// Wallet claiming the handle; also the rent payer.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// PDA for this handle: `seeds = [b"upi", <instruction arg: handle>]`.
    /// `init` guarantees the handle was free at registration.
    #[account(
        init,
        payer = payer,
        space = RECORD_SPACE,
        seeds = [b"upi", handle.as_bytes()],
        bump,
    )]
    pub record: Account<'info, HandleRecord>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PayToHandle<'info> {
    /// Sender of the payment.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Unchecked by type on purpose: the handler enforces
    /// recipient == handle_record.authority (UpiError::NotRecipient),
    /// so a wrong destination fails at program level instead of transferring.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,

    /// Registry PDA for the handle being paid; canonicality re-checked in-handler.
    pub handle_record: Account<'info, HandleRecord>,

    pub system_program: Program<'info, System>,
}

fn validate_handle(handle: &str) -> Result<()> {
    if handle.is_empty() || handle.len() > MAX_HANDLE_LEN {
        return Err(UpiError::InvalidLength.into());
    }
    let valid = handle
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '.' || c == '_' || c == '-');
    if !valid {
        return Err(UpiError::InvalidCharacters.into());
    }
    Ok(())
}
