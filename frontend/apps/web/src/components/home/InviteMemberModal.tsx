'use client';
import SlidePanel from './SlidePanel';
import SenderInvitationManager from './invitations/SenderInvitationManager';
export default function InviteMemberModal({open,onClose,homeId}:{open:boolean;onClose:()=>void;homeId:string}) {
  return <SlidePanel open={open} onClose={onClose} title="Invite Member">
    {open&&<SenderInvitationManager homeId={homeId}/>}
  </SlidePanel>;
}
