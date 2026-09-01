interface NormalizedService {
  id: string;
  name: string;
  promise: string;
  price: number | string | null;
  availability: string;
}

interface ServicesTabProps {
  services: NormalizedService[];
  skills: string[];
  onRequest: () => void;
  isOwner: boolean;
  onEdit: () => void;
}

export default function ServicesTab({ services, skills, onRequest, isOwner, onEdit }: ServicesTabProps) {
  if (services.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-app p-6">
        <h3 className="text-lg font-semibold text-app mb-2">Featured Services</h3>
        <p className="text-sm text-app-secondary mb-4">No services published yet.</p>
        {isOwner ? (
          <button onClick={onEdit} className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium">Add your first service</button>
        ) : (
          <button onClick={onRequest} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium">Request help</button>
        )}
        {skills.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {skills.slice(0, 8).map((skill, i) => (
              <span key={`${skill}-${i}`} className="px-3 py-1 rounded-full text-sm bg-surface-muted text-app-strong">{skill}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {services.map((service) => (
        <div key={service.id} className="bg-surface rounded-xl border border-app p-5">
          <h4 className="font-semibold text-app text-lg">{service.name}</h4>
          <p className="text-sm text-app-secondary mt-2">{service.promise}</p>
          <p className="text-sm text-app mt-3 font-medium">{service.price ? `From $${service.price}` : 'Pricing on request'}</p>
          <p className="text-xs text-app-secondary mt-1">{service.availability}</p>
          {!isOwner && (
            <button onClick={onRequest} className="mt-4 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium">Request this</button>
          )}
        </div>
      ))}
    </div>
  );
}
