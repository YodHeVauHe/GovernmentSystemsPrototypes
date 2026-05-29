export const UPDATE_API_SQL = `
  UPDATE apis SET
    name = $1, owning_mda_id = $2, sector = $3, description = $4, lifecycle_status = $5,
    sensitivity_level = $6, sandbox_available = $7, openapi_spec_path = $8, openapi_spec_text = $9, required_approval_level = $10,
    contact_office = $11, technical_owner = $12, personal_data_categories = $13, purpose_limitation = $14,
    data_minimization_note = $15, retention_class = $16, statutory_basis = $17, security_classification = $18,
    sla_target = $19, compliance_status = $20, docs_visibility = $21
  WHERE id = $22
`;
