// Orchestration mock only. SQL contracts exercise the database merge and guards.
module.exports = function mailMetadata(name, p, table) {
  const job = table('MailVerificationJob').find((row) => row.id === p.p_job_id);
  if (!job) return { data: false, error: null };
  const timestamp = new Date().toISOString();
  if (name === 'claim_mail_verification_dispatch') {
    if (job.vendor_status !== 'pending' || job.vendor_job_id != null
      || (job.metadata?.unit ?? null) !== p.p_expected_unit
      || JSON.stringify(job.metadata?.destination ?? null) !== JSON.stringify(p.p_expected_destination)) {
      return { data: false, error: null };
    }
    const { code, ...metadata } = job.metadata || {};
    job.vendor = p.p_vendor;
    job.vendor_status = 'dispatching';
    job.metadata = { ...metadata, destination: p.p_destination, dispatch_started_at: timestamp };
  } else {
    if (job.vendor !== 'lob' || job.vendor_job_id !== p.p_vendor_job_id) return { data: false, error: null };
    job.vendor_status = p.p_vendor_status;
    job.metadata = { ...job.metadata, last_webhook_event: p.p_event_type, last_webhook_at: timestamp };
  }
  job.updated_at = timestamp;
  return { data: true, error: null };
};
