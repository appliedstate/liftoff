# Human Control System: AI Manager Operating System

## Mission
Empower AI agents, terminal, and strateg.is to maximize human impact toward $5K/day Facebook margin objective through first-principles management.

## First Principles Framework

### Objective Function
**Single metric**: Net margin contribution per human per week, optimized for sustainable growth.

**Why first principles**: Business value = (Revenue - Cost) × Scale. Humans either increase revenue/cut costs or enable scaling. Measure direct impact, not activity.

### Value Streams
1. **Revenue Generation**: Launch/optimize campaigns that drive margin
2. **Cost Control**: Kill waste, optimize spend efficiency
3. **Scaling Enablement**: Build infrastructure/tools for 10x growth
4. **Knowledge Transfer**: Document processes for AI automation

### Control Loop
1. **Commit**: Weekly objectives with measurable deliverables
2. **Execute**: Daily work with progress tracking
3. **Measure**: Real metrics vs commitments
4. **Adjust**: Escalate blockers, reallocate resources, course-correct

### Decision Policy
- **Doubling down**: 2x budget/resources on humans/campaigns hitting 80%+ of objectives
- **Course correction**: 50% reduction for <50% delivery, reassign tasks
- **Pruning**: Remove humans/campaigns with negative ROI after 2-week grace

## Weekly AI Manager Loop

### Monday: Planning & Commitment
1. **Data pull**: strateg.is metrics, GitHub activity, campaign performance
2. **Performance review**: Last week's delivery vs commitments
3. **Impact Filter required**: For each person's weekly objective and any new initiative/major scale decision, complete an Impact Filter (see template) and link it.
4. **Objective setting**: This week's margin targets and deliverables (must map to Impact Filter ideal/acceptable outcomes)
5. **Resource allocation**: Budget, AI agent support, terminal access
6. **Commitment confirmation**: Humans commit to specific, measurable outcomes with Impact Filter link

### Daily: Progress Tracking
- **Morning pulse**: 5-min async check-in (template below)
- **Blocker escalation**: Immediate alerts for roadblocks
- **AI agent coordination**: Assign relevant agents for tasks
- **Terminal automation**: Standard workflows for routine tasks

### Friday: Review & Adjustment
1. **Metrics reconciliation**: Actual vs committed performance
2. **Success celebration**: Public recognition for wins
3. **Failure analysis**: Root cause for misses, corrective actions
4. **Next week planning**: Updated objectives based on learnings

## Human Roster

### Active Buyers (Revenue Generation)
```yaml
- name: Ben
  role: Senior Buyer - Dental/Health vertical lead
  objectives:
    - $1,000/day margin contribution
    - 3-5 new campaigns/week
    - 33%+ break-even rate
  kpis:
    - margin_per_spend: 0.25
    - launch_success_rate: 0.35
    - scaling_velocity: 25%_daily_budget_growth
  cadence: daily
  interfaces:
    ai_agents: [creative_generator, audience_optimizer]
    terminal: [campaign_launcher, performance_monitor]
    strateg_is: [margin_reports, scaling_alerts]

- name: TJ
  role: Volume Buyer - Broad portfolio optimization
  objectives:
    - $500/day margin contribution
    - 7-8 new campaigns/week
    - 50%+ break-even rate
  kpis:
    - margin_per_spend: 0.22
    - launch_success_rate: 0.45
    - time_to_scale: <72_hours
  cadence: daily
  interfaces:
    ai_agents: [roas_predictor, budget_optimizer]
    terminal: [bulk_launcher, alert_system]
    strateg_is: [portfolio_analytics, optimization_engine]

- name: Dan
  role: Efficient Buyer - High-ROAS specialist
  objectives:
    - $200/day margin contribution
    - 2-3 new campaigns/week
    - 40%+ break-even rate
  kpis:
    - margin_per_spend: 0.28
    - efficiency_ratio: 0.15_spend_per_conversion
    - scale_ceiling: $500_max_campaign_budget
  cadence: daily
  interfaces:
    ai_agents: [conversion_optimizer]
    terminal: [performance_tracker]
    strateg_is: [efficiency_reports]

- name: Mike
  role: Buyer - Campaign maintenance & testing
  objectives:
    - Break-even or positive margin
    - 1-2 new campaigns/week
    - Eliminate negative campaigns
  kpis:
    - margin_per_spend: 0.20
    - loss_elimination: 100%_negative_campaigns_killed
    - learning_velocity: weekly_improvement
  cadence: daily
  interfaces:
    ai_agents: [creative_tester]
    terminal: [campaign_monitor]
    strateg_is: [loss_alerts]
```

### Infrastructure Team
```yaml
- name: Eric
  role: CEO - Strategic direction & resource allocation
  objectives:
    - $5K/day margin target achievement
    - Team productivity optimization
    - Infrastructure investment decisions
  kpis:
    - team_margin_total: 5000_daily
    - productivity_per_human: weekly_roi
    - infrastructure_roi: 3x_return_on_tools
  cadence: weekly
  interfaces:
    ai_agents: [strategy_planner, resource_allocator]
    terminal: [system_monitor, automation_builder]
    strateg_is: [business_intelligence]

- name: Lian
  role: AI Agent Developer - Agent creation & optimization
  objectives:
    - 3 new agents deployed/month
    - 20% buyer productivity improvement
    - Agent accuracy >90%
  kpis:
    - agent_deployment_rate: monthly
    - productivity_lift: percentage
    - accuracy_score: percentage
  cadence: weekly
  interfaces:
    ai_agents: [meta_agent_builder]
    terminal: [agent_deployer, performance_tester]

- name: Jose
  role: Terminal Automation Engineer - Workflow optimization
  objectives:
    - 5 new automations/week
    - 50% reduction in manual tasks
    - 99.9% automation uptime
  kpis:
    - automation_deployment: weekly
    - time_saved: hours_per_week
    - reliability: uptime_percentage
  cadence: weekly
  interfaces:
    terminal: [automation_builder, system_monitor]
    strateg_is: [efficiency_metrics]

- name: Zohaib
  role: Data Engineer - Analytics & reporting infrastructure
  objectives:
    - strateg.is endpoint completion
    - Real-time dashboard deployment
    - Data pipeline 99.9% uptime
  kpis:
    - endpoint_completion: on_time
    - dashboard_usage: daily_active_users
    - pipeline_uptime: percentage
  cadence: weekly
  interfaces:
    strateg_is: [data_pipeline, api_builder]
    terminal: [reporting_automation]

- name: Henok
  role: DevOps Engineer - Platform reliability & scaling
  objectives:
    - Zero downtime incidents
    - 50% faster deployment cycles
    - Cost optimization
  kpis:
    - uptime: 99.9%
    - deployment_speed: minutes
    - cost_efficiency: percentage
  cadence: weekly
  interfaces:
    terminal: [infrastructure_monitor]
    strateg_is: [system_health]

- name: Tahmid
  role: QA/Test Engineer - Quality assurance & testing
  objectives:
    - 95% test coverage
    - Zero production bugs
    - Automated testing pipeline
  kpis:
    - test_coverage: percentage
    - bug_rate: per_release
    - automation_coverage: percentage
  cadence: weekly
  interfaces:
    terminal: [test_runner, quality_monitor]

- name: Maryna
  role: Product Manager - Requirements & prioritization
  objectives:
    - Clear PRDs for all features
    - On-time delivery rate 90%
    - Stakeholder satisfaction
  kpis:
    - prd_completion: on_time
    - delivery_rate: percentage
    - satisfaction_score: nps
  cadence: weekly
  interfaces:
    strateg_is: [requirements_tracker]
    terminal: [roadmap_planner]
```

## Interface Protocols

### Message Format Standard
All human-AI-terminal communication follows:
```
Context: [2-3 sentences background]
Ask: [Specific, actionable request]
Deadline: [Date/time expectation]
Definition of Done: [Measurable completion criteria]
```

### AI Agent Assignment Rules
- **Creative tasks**: Assign to creative_generator agent
- **Optimization**: roas_predictor or budget_optimizer
- **Analysis**: data_analyzer or performance_predictor
- **Automation**: Assign to terminal with workflow templates

### Persona AI Agents
On-demand guidance from expert personas (docs/ai-agents/):
- **aion**: First-principles problem-solving, scaling, innovation
- **warren**: Value investing, financial decisions, long-term thinking
- **steve**: Product design, user experience, brand building
- **jeff**: Operations, customer obsession, efficiency
- **sara**: Leadership, culture, team dynamics
- **jim**: Quantitative modeling, statistical rigor, signal discovery

Advisors can author systems (architectures), processes (SOPs), and tasks (atomic actions). Link outputs to Impact Filters and queue via Terminal.

**Invocation**: Use terminal commands like `aion "solve this scaling problem"`, `warren "capital allocation"`, or `jim "model ROAS nowcast"`. Queue via `ai-queue add {name} "review strategy"`. Responses include references to system docs and apply persona principles.

### Escalation Policy
- **Level 1**: Human solves within 4 hours
- **Level 2**: Escalate to team lead after 4 hours
- **Level 3**: Escalate to Eric after 24 hours with mitigation plan

## Weekly Check-in Template

**Send Monday 9AM, respond by EOD**

### Objective Status
What margin target are you committing to this week? Why is this realistic?

### Last Week Delivery
- Margin contribution: $____ (___% of commitment)
- Campaigns launched: ____ (___ successful)
- Key wins/blockers: [2-3 bullet points]

### Current Metrics
[Auto-populated from strateg.is]
- Daily margin: $____
- Active campaigns: ____
- ROAS average: ____%

### Blockers & Support Needed
What do you need from AI agents/terminal/strateg.is this week?

### This Week Commitments
- Launch ____ new campaigns
- Scale winners by ____% daily budget
- Kill ____ losing campaigns
- Specific deliverables: [bulleted list]

### Impact Filter (required)
- Title:
- Owner:
- Week (YYYY-WW):
- Purpose/Importance:
- Ideal Outcome (quant, dated):
- Best / Acceptable Result:
- Success Metrics/KPIs (targets):
- Consequences of Not Doing:
- Risks/Assumptions:
- Resources/Constraints:
- First Moves (next 7 days):
- Interfaces (AI agents / terminal / strateg.is):
- Link to doc: [path]

### Interface Updates
Any new AI agent workflows or terminal automations needed?

## Success Metrics
- **Team margin**: $5K/day achieved within 30 days
- **Human productivity**: 20% improvement quarter-over-quarter
- **System efficiency**: 50% of decisions AI-assisted
- **Retention**: 90%+ human satisfaction (measured quarterly)

## Evolution
- **Month 1**: Basic loop with manual tracking
- **Month 2**: Automated metrics and alerts
- **Month 3**: Predictive optimization and AI-driven decisions
- **Month 6**: Self-managing system with minimal human oversight
