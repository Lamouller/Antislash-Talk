-- Insert default preparation prompts for all users
-- These will be available in the Prompt Workshop with category 'preparation'

INSERT INTO public.prompt_templates (user_id, name, description, category, content, is_favorite, created_at, updated_at)
SELECT 
  id as user_id,
  'Ordre du Jour Structuré' as name,
  'Génère un ordre du jour détaillé pour la prochaine réunion' as description,
  'preparation' as category,
  E'# Préparation de Réunion - Ordre du Jour\n\nAnalyse la réunion précédente et génère un ordre du jour structuré pour la prochaine session.\n\n## Format de sortie\n\n### 1. 📋 Ordre du Jour Proposé\n\nCrée une liste numérotée des sujets à aborder, avec temps estimé :\n\n1. **[Sujet 1]** (10 min)\n   - Points clés à discuter\n   - Décisions attendues\n\n2. **[Sujet 2]** (15 min)\n   - ...\n\n### 2. ✅ Suivi Réunion Précédente\n\nListe les points de la dernière réunion qui nécessitent un suivi :\n\n- ✅ **Complété** : [description]\n- ⏳ **En cours** : [description] (responsable: [nom])\n- ❌ **Bloqué** : [description] - [raison]\n\n### 3. 🎯 Objectifs de la Session\n\nDéfinis 2-3 objectifs principaux pour cette réunion.\n\n### 4. 👥 Préparation Participants\n\nCe que chaque participant devrait préparer ou réviser avant la réunion.\n\n---\n\n**Instructions** : Sois concis, actionnable, et priorise les sujets urgents.' as content,
  false as is_favorite,
  NOW() as created_at,
  NOW() as updated_at
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_templates 
  WHERE prompt_templates.user_id = auth.users.id 
  AND prompt_templates.name = 'Ordre du Jour Structuré'
  AND prompt_templates.category = 'preparation'
);

INSERT INTO public.prompt_templates (user_id, name, description, category, content, is_favorite, created_at, updated_at)
SELECT 
  id as user_id,
  'Suivi de Tâches' as name,
  'Identifie et organise les tâches de la réunion précédente' as description,
  'preparation' as category,
  E'# Préparation de Réunion - Suivi de Tâches\n\nExtrait et organise toutes les tâches mentionnées lors de la réunion précédente pour faciliter le suivi.\n\n## Format de sortie\n\n### 📊 Tableau de Bord des Tâches\n\n#### ✅ Tâches Complétées\n| Tâche | Responsable | Date fin |\n|-------|-------------|----------|\n| [description] | [nom] | [date] |\n\n#### ⏳ Tâches En Cours\n| Tâche | Responsable | Échéance | Progression |\n|-------|-------------|----------|-------------|\n| [description] | [nom] | [date] | [%] |\n\n#### ❌ Tâches En Retard\n| Tâche | Responsable | Échéance initiale | Bloqueur |\n|-------|-------------|-------------------|----------|\n| [description] | [nom] | [date] | [raison] |\n\n#### 📝 Nouvelles Tâches à Assigner\n| Tâche | Priorité | Effort estimé |\n|-------|----------|---------------|\n| [description] | Haute/Moyenne/Basse | [heures/jours] |\n\n### 🎯 Actions Prioritaires pour Prochaine Réunion\n\n1. **[Tâche prioritaire 1]**\n   - Pourquoi c''est urgent\n   - Impact si non fait\n\n2. **[Tâche prioritaire 2]**\n   - ...\n\n---\n\n**Instructions** : Identifie TOUTES les tâches, même implicites. Sois précis sur les responsables et échéances.' as content,
  false as is_favorite,
  NOW() as created_at,
  NOW() as updated_at
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_templates 
  WHERE prompt_templates.user_id = auth.users.id 
  AND prompt_templates.name = 'Suivi de Tâches'
  AND prompt_templates.category = 'preparation'
);

INSERT INTO public.prompt_templates (user_id, name, description, category, content, is_favorite, created_at, updated_at)
SELECT 
  id as user_id,
  'Points Non Résolus' as name,
  'Identifie les questions et sujets à rediscuter' as description,
  'preparation' as category,
  E'# Préparation de Réunion - Points Non Résolus\n\nIdentifie les questions ouvertes, décisions reportées, et sujets qui nécessitent une discussion approfondie.\n\n## Format de sortie\n\n### ❓ Questions Sans Réponse\n\n1. **[Question 1]**\n   - Contexte : [pourquoi cette question]\n   - Impact : [conséquences si non résolue]\n   - Qui peut répondre : [personne/équipe]\n\n### ⏸️ Décisions Reportées\n\n1. **[Sujet de décision]**\n   - Options discutées : \n     - Option A : [avantages/inconvénients]\n     - Option B : [avantages/inconvénients]\n   - Raison du report : [manque d''info, besoin validation, etc.]\n   - Date limite décision : [date]\n\n### 🔄 Sujets à Reprendre\n\n- **[Sujet 1]** : Discussion interrompue car [raison]\n- **[Sujet 2]** : Nécessite plus de données de [source]\n\n### 💡 Recommandations\n\nPour chaque point non résolu, suggère :\n- Actions préparatoires avant la réunion\n- Personnes à inviter/consulter\n- Documents à préparer\n\n---\n\n**Instructions** : Sois factuel. Identifie les vrais bloqueurs et propose des solutions concrètes.' as content,
  false as is_favorite,
  NOW() as created_at,
  NOW() as updated_at
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_templates 
  WHERE prompt_templates.user_id = auth.users.id 
  AND prompt_templates.name = 'Points Non Résolus'
  AND prompt_templates.category = 'preparation'
);

INSERT INTO public.prompt_templates (user_id, name, description, category, content, is_favorite, created_at, updated_at)
SELECT 
  id as user_id,
  'Brief Participants' as name,
  'Crée un résumé pour préparer les participants' as description,
  'preparation' as category,
  E'# Préparation de Réunion - Brief Participants\n\nGénère un document concis pour que les participants arrivent préparés à la prochaine réunion.\n\n## Format de sortie\n\n# Brief - Réunion du [DATE]\n\n## 📌 Contexte Rapide\n\n[2-3 phrases résumant l''objectif de la réunion et le contexte de la dernière session]\n\n## 🎯 Objectifs de la Session\n\n1. [Objectif 1]\n2. [Objectif 2]\n3. [Objectif 3]\n\n## 📚 À Réviser Avant\n\n- **Documents** :\n  - [Doc 1] : [pourquoi important]\n  - [Doc 2] : [pourquoi important]\n\n- **Décisions Précédentes** :\n  - [Décision 1] et ses implications\n  - [Décision 2] et ses implications\n\n## 💼 Préparation Par Rôle\n\n### [Rôle/Personne 1]\n- [ ] [Action à préparer]\n- [ ] [Question à réfléchir]\n\n### [Rôle/Personne 2]\n- [ ] [Action à préparer]\n- [ ] [Question à réfléchir]\n\n## ⏰ Logistique\n\n- **Durée estimée** : [X] minutes\n- **Points critiques** : [sujets qui prendront le plus de temps]\n- **Matériel nécessaire** : [écran, tableau, etc.]\n\n## ❓ Questions à Anticiper\n\n1. [Question probable 1]\n2. [Question probable 2]\n\n---\n\n**Format** : Sobre, scannable, actionnable. Maximum 1 page.' as content,
  false as is_favorite,
  NOW() as created_at,
  NOW() as updated_at
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_templates 
  WHERE prompt_templates.user_id = auth.users.id 
  AND prompt_templates.name = 'Brief Participants'
  AND prompt_templates.category = 'preparation'
);
