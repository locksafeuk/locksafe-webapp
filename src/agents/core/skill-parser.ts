// Skill Parser - reads SKILL.md files and generates system prompts

import type { ParsedSkills, Skill } from './types';

export async function parseSkillsFile(filePath: string): Promise<ParsedSkills> {
  try {
    const fs = await import('fs/promises');
    const content = await fs.readFile(filePath, 'utf-8');
    return parseSkillsContent(content);
  } catch (error) {
    console.warn(`[SkillParser] Could not read skills file: ${filePath}`, error);
    return {
      name: 'Unknown Agent',
      description: 'No skills file found',
      skills: [],
      systemPrompt: 'You are a helpful assistant.',
    };
  }
}

export function parseSkillsContent(content: string): ParsedSkills {
  const lines = content.split('\n');
  let name = 'Agent';
  let description = '';
  const skills: Skill[] = [];
  let currentSkill: Partial<Skill> | null = null;
  let priority = 1;

  for (const line of lines) {
    const trimmed = line.trim();

    // Parse name from first H1
    if (trimmed.startsWith('# ') && name === 'Agent') {
      name = trimmed.slice(2).trim();
      continue;
    }

    // Parse description from first paragraph after name
    if (!description && !trimmed.startsWith('#') && trimmed.length > 0 && name !== 'Agent') {
      description = trimmed;
      continue;
    }

    // Parse skills from H2 headers
    if (trimmed.startsWith('## ')) {
      if (currentSkill && currentSkill.name) {
        skills.push(currentSkill as Skill);
      }
      currentSkill = {
        name: trimmed.slice(3).trim(),
        description: '',
        priority: priority++,
      };
      continue;
    }

    // Add description to current skill
    if (currentSkill && trimmed.length > 0 && !trimmed.startsWith('#')) {
      currentSkill.description = currentSkill.description
        ? `${currentSkill.description} ${trimmed}`
        : trimmed;
    }
  }

  // Push last skill
  if (currentSkill && currentSkill.name) {
    skills.push(currentSkill as Skill);
  }

  const systemPrompt = generateSystemPrompt({ name, description, skills, systemPrompt: '' });

  return { name, description, skills, systemPrompt };
}

export function generateSystemPrompt(skills: ParsedSkills): string {
  const skillsList = skills.skills
    .map((s) => `- ${s.name}: ${s.description}`)
    .join('\n');

  return `You are ${skills.name}. ${skills.description}\n\nYour skills:\n${skillsList}\n\nAlways act within your defined skills and capabilities.`;
}

export function validateSkills(skills: ParsedSkills): boolean {
  if (!skills.name || skills.name.length === 0) return false;
  if (!skills.skills || skills.skills.length === 0) return false;
  for (const skill of skills.skills) {
    if (!skill.name || !skill.description) return false;
  }
  return true;
}
