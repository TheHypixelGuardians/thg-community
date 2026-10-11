import { getAllLinks } from './linkedAccounts.js';
import { applyLinkRoleById, describeFailure, getLinkRoleId } from './linkRole.js';

export interface LinkRoleSyncSummary {
  granted: number;
  alreadyHad: number;
  /** Linked users who are no longer in the server. */
  missing: number;
  failed: number;
  /** The first hard failure, phrased for an admin. */
  failure: string | null;
}

/**
 * Grants the configured link role to everybody who already has a link.
 *
 * The stored links are the source of truth and the roles are derived from them,
 * so they have to be brought up to date at startup and again whenever an admin
 * points `/linkrole` at a different role. This only ever *adds*: members who
 * hold the role without a link are left alone, since the role may well be handed
 * out for other reasons too.
 */
export async function syncLinkRoles(guildId: string): Promise<LinkRoleSyncSummary> {
  const summary: LinkRoleSyncSummary = {
    granted: 0,
    alreadyHad: 0,
    missing: 0,
    failed: 0,
    failure: null,
  };

  if (!(await getLinkRoleId(guildId))) return summary;

  const links = await getAllLinks();

  for (const [index, link] of links.entries()) {
    const result = await applyLinkRoleById(guildId, link.discordId, 'add');

    if (result.ok) {
      if (result.changed) summary.granted++;
      else summary.alreadyHad++;
      continue;
    }

    if (result.reason === 'no-member') {
      summary.missing++;
      continue;
    }

    summary.failed++;
    summary.failure ??= describeFailure(result);

    // A missing role or a permission problem applies to every remaining member
    // as well; retrying it once per link just burns rate limit.
    if (result.reason === 'missing-role' || result.reason === 'forbidden') {
      summary.failed += links.length - index - 1;
      break;
    }
  }

  return summary;
}
