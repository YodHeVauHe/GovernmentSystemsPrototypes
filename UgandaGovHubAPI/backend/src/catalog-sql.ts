export const UPDATE_API_SQL = `
  UPDATE apis SET
    name = ?, owning_mda_id = ?, sector = ?, description = ?, lifecycle_status = ?,
    sensitivity_level = ?, sandbox_available = ?, openapi_spec_path = ?, openapi_spec_text = ?, required_approval_level = ?,
    contact_office = ?, technical_owner = ?, personal_data_categories = ?, purpose_limitation = ?,
    data_minimization_note = ?, retention_class = ?, statutory_basis = ?, security_classification = ?,
    sla_target = ?, compliance_status = ?, docs_visibility = ?
  WHERE id = ?
`;
