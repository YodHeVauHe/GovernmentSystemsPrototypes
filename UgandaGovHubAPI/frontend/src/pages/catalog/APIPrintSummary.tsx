export function APIPrintSummary({ api }: { api: any }) {
  return (
    <div className="p-8 bg-white text-black border border-gray-300 rounded-lg max-w-[800px] mx-auto text-left shadow-md flex flex-col gap-6">
      <div className="border-b-2 border-gray-900 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{api.name}</h1>
            <p className="text-sm font-mono text-gray-600 mt-1">ID Reference: {api.id}</p>
          </div>
          <span className="border-2 border-black font-bold uppercase tracking-wider text-xs px-3 py-1 bg-gray-100">
            {api.lifecycle_status}
          </span>
        </div>
        <p className="text-[14px] text-gray-800 mt-3 leading-relaxed">{api.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
        <div>
          <span className="block text-[11px] uppercase tracking-wider font-mono text-gray-500">Owning MDA (Data Owner)</span>
          <span className="font-semibold text-gray-900">
            {api.owning_mda_id === 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41' ? 'National Identification and Registration Authority (NIRA)' :
             api.owning_mda_id === 'mda-ura-2efff0d3-952e-4475-8231-232873a69854' ? 'Uganda Revenue Authority (URA)' :
             api.owning_mda_id === 'mda-ursb-94540e99-0027-4cd7-86ca-664d3776c4f5' ? 'Uganda Registration Services Bureau (URSB)' :
             api.owning_mda_id === 'mda-mowt-800aedbd-9c89-4df5-91d8-4250120003c7' ? 'Ministry of Works and Transport (MoWT)' :
             'Ministry of ICT and National Guidance (MoICT)'}
          </span>
        </div>

        <div>
          <span className="block text-[11px] uppercase tracking-wider font-mono text-gray-500">Technical Owner</span>
          <span className="font-semibold text-gray-900">{api.technical_owner}</span>
        </div>

        <div>
          <span className="block text-[11px] uppercase tracking-wider font-mono text-gray-500">Administrative Contact</span>
          <span className="font-semibold text-gray-900">{api.contact_office}</span>
        </div>

        <div>
          <span className="block text-[11px] uppercase tracking-wider font-mono text-gray-500">Security Classification</span>
          <span className="font-semibold text-gray-900 font-mono">{api.security_classification}</span>
        </div>

        <div className="col-span-2 border-t border-gray-200 pt-3">
          <span className="block text-[11px] uppercase tracking-wider font-mono text-gray-500">Statutory / Legal Basis</span>
          <span className="text-gray-900 italic font-serif">"{api.statutory_basis}"</span>
        </div>

        <div className="col-span-2 border-t border-gray-200 pt-3">
          <span className="block text-[11px] uppercase tracking-wider font-mono text-gray-500">Purpose Limitation Statement</span>
          <span className="text-gray-800 leading-relaxed">{api.purpose_limitation}</span>
        </div>

        <div className="col-span-2 border-t border-gray-200 pt-3">
          <span className="block text-[11px] uppercase tracking-wider font-mono text-gray-500">Data Minimization Design Stance</span>
          <span className="text-gray-800 leading-relaxed">{api.data_minimization_note}</span>
        </div>

        <div className="col-span-2 border-t border-gray-200 pt-3 grid grid-cols-2 gap-4">
          <div>
            <span className="block text-[11px] uppercase tracking-wider font-mono text-gray-500">Personal Data Categories</span>
            <span className="text-gray-800">{api.personal_data_categories}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wider font-mono text-gray-500">Retention Stance</span>
            <span className="text-gray-800">{api.retention_class}</span>
          </div>
        </div>

        <div className="col-span-2 border-t-2 border-gray-900 pt-4 flex justify-between items-center text-[10px] text-gray-500">
          <span>Uganda GovHub Interoperability Framework (GIRA / e-GIF) Compliant Document</span>
          <span>Printed: {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
