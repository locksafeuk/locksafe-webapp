/**
 * Business Intelligence API
 *
 * GET - Retrieve BI reports, KPIs, health scores, and agent performance data
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateBIReport,
  getBusinessHealthSnapshot,
} from '@/agents/core/business-intelligence';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'report';

    switch (action) {
      case 'report': {
        const report = await generateBIReport();
        return NextResponse.json({
          success: true,
          data: report,
          timestamp: new Date().toISOString(),
        });
      }

      case 'health': {
        const snapshot = await getBusinessHealthSnapshot();
        return NextResponse.json({
          success: true,
          data: snapshot,
          timestamp: new Date().toISOString(),
        });
      }

      case 'kpis': {
        const report = await generateBIReport();
        return NextResponse.json({
          success: true,
          data: { kpis: report.kpis, healthScore: report.healthScore },
          timestamp: new Date().toISOString(),
        });
      }

      case 'agents': {
        const report = await generateBIReport();
        return NextResponse.json({
          success: true,
          data: { agentPerformance: report.agentPerformance },
          timestamp: new Date().toISOString(),
        });
      }

      case 'recommendations': {
        const report = await generateBIReport();
        return NextResponse.json({
          success: true,
          data: { recommendations: report.recommendations, healthScore: report.healthScore },
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}. Valid: report, health, kpis, agents, recommendations` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API] Business Intelligence GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
