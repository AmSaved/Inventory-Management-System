require('dotenv').config();
const { sequelize, Workflow, WorkflowStep, Role, WorkflowStatus } = require('./models');

async function run() {
  await sequelize.authenticate();
  console.log("Database connected!");

  const workflows = await Workflow.findAll({
    include: [
      {
        model: WorkflowStep,
        as: 'steps',
        include: [
          { model: Role, as: 'requiredRole' },
          { model: WorkflowStatus, as: 'statusLabel' }
        ]
      }
    ]
  });

  for (const wf of workflows) {
    console.log(`\nWorkflow: ${wf.name} (Type: ${wf.resource_type})`);
    for (const step of wf.steps || []) {
      console.log(`  Step Order: ${step.step_order} | Role: ${step.requiredRole?.name} | Permission: ${step.required_permission} | Label: ${step.statusLabel?.name}`);
    }
  }

  await sequelize.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
