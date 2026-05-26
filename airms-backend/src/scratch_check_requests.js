require('dotenv').config();
const { sequelize, Request, WorkflowStep, WorkflowRoute } = require('./models');

async function run() {
  await sequelize.authenticate();
  console.log("Database connected!");

  const requests = await Request.findAll({
    limit: 20,
    order: [['created_at', 'DESC']],
    include: ['items']
  });

  for (const r of requests) {
    console.log(`ID: ${r.id} | No: ${r.request_number} | Type: ${r.request_type} | Status: ${r.status} | WorkflowStatus: ${r.workflow_status} | StepId: ${r.current_step_id} | Created: ${r.created_at}`);
  }

  await sequelize.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
