# Root Command Inventory (Wave 1)

Generated: 2026-06-03

## Summary

- Root `.command` launchers found: 45
- Policy for this wave: inventory first, archive/delete in next wave after ownership and usage confirmation.

## Inventory

1. audit-district-content.command
2. backfill-coverage-v2.command
3. check-alias.command
4. cleanup-corrupt-featured-engineer-names.command
5. commit-phase2-launchers.command
6. coverage-density-by-area.command
7. create-conversion-action.command
8. deploy-autopause-fix.command
9. deploy-locksmith-in-hub.command
10. deploy-quote-total-fix.command
11. deploy-self-diagnose.command
12. deploy-status-fix.command
13. deploy-tel-link-attribution.command
14. deploy-tracker-fix.command
15. deploy.command
16. diag-district-state.command
17. diag-route-registration.command
18. fix-deploy.command
19. fix-locksmith-route-collision.command
20. force-pause-removed-campaigns.command
21. hotfix-district-dynamic-params.command
22. hotfix-force-dynamic.command
23. hotfix-prisma-schema.command
24. hotfix-remove-static-cache-override.command
25. launch-discovery-campaigns-LIVE.command
26. recommend-recruitment.command
27. recompose-discovery-drafts.command
28. reconcile-campaign-drift.command
29. remediate-removed-drift.command
30. review-discovery-campaigns.command
31. run-district-landings-build.command
32. run-phase2a-tests.command
33. run-phase2b-budget-caps.command
34. run-phase2b-intent-score.command
35. run-phase2b-shark-saturation.command
36. run-phase2c-campaign-generator.command
37. run-phase2c-orchestrator.command
38. run-phase3a-tests-and-deploy.command
39. run-phase3b-tests-and-deploy.command
40. seed-keyword-bank.command
41. smoketest.command
42. triage.command
43. unlock-and-deploy.command
44. verify-attribution.command
45. verify-session-attribution.command

## Next step

Classify each command as `keep`, `archive`, or `delete` using evidence:
1. Is it referenced by docs/runbooks?
2. Is it used in current production operations?
3. Does an npm script supersede it?
