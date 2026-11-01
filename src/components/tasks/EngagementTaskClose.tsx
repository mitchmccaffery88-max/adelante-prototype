import { useState } from 'react';
import { toast } from 'sonner';
import { AdelanteEHR, type CaseTask } from '@/lib/ehr';
import { useActingStaff } from '@/lib/roles';
import { engagementTaskGate } from '@/lib/engagementRiskAutomation';
import { ENGAGEMENT_DRAFT, ENGAGEMENT_OUTCOMES } from '@/lib/engagementRisk';
import { runAction } from '@/lib/actions/runAction';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export function EngagementTaskClose({ task, canWrite }: { task: CaseTask; canWrite: boolean }) {
  const acting = useActingStaff();
  const actor = { role: acting.role, staffId: acting.staffId };
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState('');
  if (!canWrite || !engagementTaskGate(actor, task)) return null;
  function save() {
    if (!ENGAGEMENT_OUTCOMES.some(value => value === outcome)) return;
    const result = runAction('engagement_task_close', actor, AdelanteEHR.getPatient(task.patientId), {
      via: 'closeEngagementTask', args: [{ taskId: task.id, actor, outcome, note }],
    });
    if (!result.ok) { toast.error(result.reason); return; }
    setOpen(false); setOutcome(''); setNote('');
    toast.success('Engagement check-in closed.');
  }
  return <>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Close</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Close engagement check-in</DialogTitle><DialogDescription>{ENGAGEMENT_DRAFT}</DialogDescription></DialogHeader>
        <fieldset className="space-y-3"><legend className="mb-2 text-sm font-medium">Outcome (required)</legend>
          <RadioGroup value={outcome} onValueChange={setOutcome} aria-label="Engagement outcome">
            {ENGAGEMENT_OUTCOMES.map((value, index) => <div key={value} className="flex items-center gap-2"><RadioGroupItem value={value} id={`${task.id}-outcome-${index}`} /><Label htmlFor={`${task.id}-outcome-${index}`}>{value}</Label></div>)}
          </RadioGroup>
        </fieldset>
        <div className="space-y-2"><Label htmlFor={`${task.id}-close-note`}>Note (optional)</Label><Textarea id={`${task.id}-close-note`} rows={2} maxLength={280} value={note} onChange={event => setNote(event.target.value)} /></div>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={!ENGAGEMENT_OUTCOMES.some(value => value === outcome)}>Close check-in</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}