use anchor_lang::prelude::*;

declare_id!("DAQ5wF3cjHjdiQbAVi2EQ7KjakGkpn5XRy67MCTpyQ5B");

#[program]
pub mod capsulex_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
