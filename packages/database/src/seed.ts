/**
 * Database seed — creates the CollabAI Demo project with members and tasks.
 * Run with: pnpm db:seed
 */
import { PrismaClient, TaskStatus, TaskPriority, ProjectMemberRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.info('🌱 Seeding database...');

  // ── Users ────────────────────────────────────────────────────────────────
  const maki = await prisma.user.upsert({
    where: { email: 'maki@collabai.dev' },
    update: {},
    create: {
      name: 'Maki',
      email: 'maki@collabai.dev',
    },
  });

  const alex = await prisma.user.upsert({
    where: { email: 'alex@collabai.dev' },
    update: {},
    create: {
      name: 'Alex',
      email: 'alex@collabai.dev',
    },
  });

  const bea = await prisma.user.upsert({
    where: { email: 'bea@collabai.dev' },
    update: {},
    create: {
      name: 'Bea',
      email: 'bea@collabai.dev',
    },
  });

  console.info(`✅ Users created: ${maki.name}, ${alex.name}, ${bea.name}`);

  // ── Project ───────────────────────────────────────────────────────────────
  const project = await prisma.project.upsert({
    where: { id: 'seed-project-collabai-demo' },
    update: {
      name: 'CollabAI Demo',
      description:
        'Demonstration project for the Arxion agent-agnostic collaboration platform.',
    },
    create: {
      id: 'seed-project-collabai-demo',
      name: 'CollabAI Demo',
      description:
        'Demonstration project for the Arxion agent-agnostic collaboration platform.',
      createdById: maki.id,
    },
  });

  console.info(`✅ Project created: ${project.name} (${project.id})`);

  // ── Project Members ────────────────────────────────────────────────────────
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: maki.id } },
    update: {},
    create: { projectId: project.id, userId: maki.id, role: ProjectMemberRole.OWNER },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: alex.id } },
    update: {},
    create: { projectId: project.id, userId: alex.id, role: ProjectMemberRole.MEMBER },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: bea.id } },
    update: {},
    create: { projectId: project.id, userId: bea.id, role: ProjectMemberRole.MEMBER },
  });

  console.info(`✅ Project members added: Maki (OWNER), Alex (MEMBER), Bea (MEMBER)`);

  // ── Tasks ────────────────────────────────────────────────────────────────
  const t101 = await prisma.task.upsert({
    where: { projectId_displayId: { projectId: project.id, displayId: 'T-101' } },
    update: {},
    create: {
      projectId: project.id,
      displayId: 'T-101',
      title: 'Create User Schema',
      description:
        'Design and implement the PostgreSQL schema for the User entity including id, name, email, timestamps.',
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      createdById: maki.id,
      acceptanceCriteria: [
        'PostgreSQL schema matches User entity design',
        'Id, name, email, and timestamp columns are present',
        'Prisma migration applies cleanly',
      ],
    },
  });

  const t102 = await prisma.task.upsert({
    where: { projectId_displayId: { projectId: project.id, displayId: 'T-102' } },
    update: {},
    create: {
      projectId: project.id,
      displayId: 'T-102',
      title: 'Build Login API',
      description:
        'Implement the login REST API endpoint including authentication logic, JWT issuance, and error handling.',
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      createdById: maki.id,
      acceptanceCriteria: [
        'POST /api/login endpoint returns 200 with JWT on valid credentials',
        'Returns 401 on invalid credentials',
        'Unit tests pass with >80% coverage',
      ],
    },
  });

  const t103 = await prisma.task.upsert({
    where: { projectId_displayId: { projectId: project.id, displayId: 'T-103' } },
    update: {},
    create: {
      projectId: project.id,
      displayId: 'T-103',
      title: 'Create Login Interface',
      description:
        'Build the frontend login form and integrate it with the Login API. Handle loading and error states.',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      createdById: maki.id,
      acceptanceCriteria: [
        'Responsive login form with email and password inputs',
        'Shows loading spinner during authentication',
        'Displays error alert on 401 responses',
      ],
    },
  });

  console.info(`✅ Tasks created: ${t101.displayId}, ${t102.displayId}, ${t103.displayId}`);

  // ── Task Dependencies ─────────────────────────────────────────────────────
  // T-102 depends on T-101
  await prisma.taskDependency.upsert({
    where: {
      taskId_dependsOnTaskId: { taskId: t102.id, dependsOnTaskId: t101.id },
    },
    update: {},
    create: {
      taskId: t102.id,
      dependsOnTaskId: t101.id,
    },
  });

  // T-103 depends on T-102
  await prisma.taskDependency.upsert({
    where: {
      taskId_dependsOnTaskId: { taskId: t103.id, dependsOnTaskId: t102.id },
    },
    update: {},
    create: {
      taskId: t103.id,
      dependsOnTaskId: t102.id,
    },
  });

  console.info(`✅ Dependencies created: T-102 depends on T-101, T-103 depends on T-102`);

  // ── Seed Activity ─────────────────────────────────────────────────────────
  await prisma.taskActivity.createMany({
    skipDuplicates: true,
    data: [
      {
        projectId: project.id,
        taskId: t101.id,
        userId: maki.id,
        type: 'task.created',
        message: `Task ${t101.displayId} "${t101.title}" was created.`,
      },
      {
        projectId: project.id,
        taskId: t102.id,
        userId: maki.id,
        type: 'task.created',
        message: `Task ${t102.displayId} "${t102.title}" was created.`,
      },
      {
        projectId: project.id,
        taskId: t103.id,
        userId: maki.id,
        type: 'task.created',
        message: `Task ${t103.displayId} "${t103.title}" was created.`,
      },
    ],
  });

  console.info(`✅ Initial activity log created`);
  console.info('');
  console.info('🎉 Seed complete!');
  console.info('');
  console.info(`   Project:  ${project.name}`);
  console.info(`   Members:  Maki, Alex, Bea`);
  console.info(`   Tasks:    T-101, T-102, T-103`);
  console.info(`   T-102 depends on T-101`);
  console.info(`   T-103 depends on T-102`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
