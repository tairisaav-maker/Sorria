# Database — Sorria

## Migrations

1. `20251004000000_fase0_foundation.sql`
2. `20251005000000_fase1_authz_equipe.sql`
3. `20251006000000_fase2_patients.sql`
4. `20251007000000_fase3_agenda.sql`
5. `20251008000000_fase4_prontuario.sql`

## Fase 4 — Prontuário

### `clinic_members.clinical_access`

Opt-in de acesso clínico. Owner sem flag não acessa prontuário.  
Migration revoga permissões clínicas do papel `owner` no catálogo.

### `anamneses`

| Coluna | Notas |
| --- | --- |
| template_version | default 1 |
| status | draft / submitted / reviewed |
| answered_by / answered_at | |
| reviewed_by / reviewed_at | |

### `anamnesis_answers`

`question_key` + `value_bool` / `value_text` · unique (anamnesis_id, question_key)

### `clinical_entries`

Queixa, exame, procedimento, conduta, orientações, próximo passo, `related_teeth[]`,  
`follow_up_required`, `follow_up_interval_days`, `status` draft|finalized, `signed_at`, `version_number`

### `clinical_entry_versions`

Snapshots imutáveis: `version_number`, `snapshot_json`, `changed_by`, `change_reason`

### `odontogram_entries`

FDI `tooth_number`, `condition`, `planned_procedure`, `notes` · unique (clinic, patient, tooth)

### `attachments`

Storage path privado, MIME, `patient_visible` default false, vínculo opcional a evolução

### Storage

Bucket privado `clinical-files`  
Path: `clinic/{clinicId}/patient/{patientId}/clinical/...`  
Policies RLS no storage + signed URL temporária

### Índices

`(clinic_id, patient_id, created_at)` em entries/attachments; follow-up parcial; odontogram por paciente
