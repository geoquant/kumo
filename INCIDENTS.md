# Incidents

Kumo (`@cloudflare/kumo`) is a **UI component library** consumed by other applications, not edge infrastructure. It does not directly serve production traffic, handle user data, or run critical control planes.

## Production-Adjacent Surfaces

| Surface                          | Risk                                                                          | Mitigation                                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| npm package (`@cloudflare/kumo`) | Broken styles, missing exports, or runtime errors propagate to consuming apps | Changesets enforce semver; CI runs build + typecheck + structural import tests                                    |
| Docs site (`kumo-ui.com`)        | Outdated or broken documentation misleads consumers                           | Preview deployments on every PR via Cloudflare Workers                                                            |
| Visual regression                | Unintentional styling changes ship undetected                                 | VR detection in `preview.yml` posts before/after screenshots to PR comments (informational, does not block merge) |
| CSS class contract               | Public CSS class names removed or renamed                                     | `tests/css-contract/css-classes.test.ts` manifest; removal requires major version bump                            |
| Browser compatibility            | ES2023+ APIs in dist break older browsers                                     | `tests/build/browser-compat.test.ts` post-build scan with banned API list                                         |

## Historical Incidents

No incidents recorded. This library has not caused a production outage in consuming applications.

## Incident Template

When recording an incident, append to this file:

```markdown
### YYYY-MM-DD — Brief title

- **Severity:** low | medium | high | critical
- **Summary:** What happened and what users experienced
- **Root cause:** Why it happened (technical root cause)
- **Resolution:** How it was fixed and when
- **Prevention:** What was added to prevent recurrence (tests, lint rules, CI checks)
```
