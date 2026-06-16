import { getDefaultGoogleAdsClient } from '../src/lib/google-ads';

async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error('no client');

  console.log('===== CONVERSION ACTIONS — full list (all statuses) =====');
  const all = await ctx.client.query(
    'SELECT conversion_action.resource_name, conversion_action.id, conversion_action.name, ' +
    'conversion_action.status, conversion_action.type, conversion_action.category, ' +
    'conversion_action.primary_for_goal, conversion_action.click_through_lookback_window_days, ' +
    'conversion_action.phone_call_duration_seconds, conversion_action.counting_type, ' +
    'conversion_action.attribution_model_settings.attribution_model ' +
    'FROM conversion_action'
  );
  for (const r of (all as any[])) {
    const a = r.conversionAction;
    console.log('id=' + a.id + ' :: ' + a.name);
    console.log('  status=' + a.status + ' :: type=' + a.type + ' :: category=' + a.category);
    console.log('  primary_for_goal=' + (a.primaryForGoal ?? false) + ' :: counting=' + a.countingType);
    if (a.phoneCallDurationSeconds) console.log('  phoneMinDuration=' + a.phoneCallDurationSeconds + 's');
    console.log('');
  }

  console.log('\n===== CUSTOMER CONVERSION GOALS (where the categories are defined) =====');
  const goals = await ctx.client.query(
    'SELECT customer_conversion_goal.category, customer_conversion_goal.origin, customer_conversion_goal.biddable ' +
    'FROM customer_conversion_goal'
  );
  for (const r of (goals as any[])) {
    const g = r.customerConversionGoal;
    console.log('  category=' + g.category + ' :: origin=' + g.origin + ' :: biddable=' + g.biddable);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
