import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardHelpers = fs.readFileSync(
  path.join(currentDir, 'page-components', 'dashboard-page-helpers.tsx'),
  'utf8',
);
const accountReviewActions = fs.readFileSync(
  path.join(currentDir, 'page-components', 'account-review-actions.ts'),
  'utf8',
);
const accountsPanel = fs.readFileSync(
  path.join(currentDir, 'page-components', 'AccountsPanel.tsx'),
  'utf8',
);
const dashboardDrawers = fs.readFileSync(
  path.join(currentDir, 'page-components', 'DashboardDrawers.tsx'),
  'utf8',
);
const dashboardDialogs = fs.readFileSync(
  path.join(currentDir, 'page-components', 'DashboardDialogs.tsx'),
  'utf8',
);

assert.equal(
  dashboardHelpers.includes("normalizedAccountType === 'government_employee'"),
  true,
  'Government employee reviewer approvals require an assigned MDA.',
);

assert.equal(
  dashboardHelpers.includes(
    'const approvalAccountCategory = account.account?.profile?.account_category || account.account_type;',
  ),
  true,
  'Approval defaults should use the verified account category when profile and signup category differ.',
);

assert.equal(
  dashboardHelpers.includes('const needsMda = approvalRequiresMda(approvalAccountCategory, selectedRole);'),
  true,
  'Approval defaults should pass the verified account category into MDA requirement checks.',
);

assert.equal(
  accountReviewActions.includes('message: `Your account request was rejected${reason'),
  false,
  'Persistent account notifications must not store free-form rejection reasons in localStorage.',
);

assert.equal(
  accountReviewActions.includes('message: `Your verification profile needs more information${notes'),
  false,
  'Persistent account notifications must not store free-form review notes in localStorage.',
);

assert.equal(
  accountsPanel.includes('onClick={() => setSelectedAccount(account)}')
    && accountsPanel.includes('onClick={() => setSelectedAccount(user)}'),
  true,
  'Account cards and account list rows should open the selected account details drawer.',
);

assert.equal(
  dashboardDrawers.includes('Account Request Details')
    && dashboardDrawers.includes('Verification Documents'),
  true,
  'Selected account drawer should show account request and verification details.',
);

assert.equal(
  dashboardDialogs.includes('accountActionDialog')
    && dashboardDialogs.includes('confirmAccountAction')
    && dashboardDialogs.includes('Reject account')
    && dashboardDialogs.includes('Delete permanently'),
  true,
  'Account action dialogs should render for reject, needs-info, suspend, and delete actions.',
);
