import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import InviteFlow from '../src/components/home/members/InviteFlow';
import { useSender } from '../src/components/home/invitations/useSender';
jest.mock('../src/components/home/invitations/useSender',()=>({useSender:jest.fn()}));
jest.mock('../src/components/home/SlidePanel',()=>({__esModule:true,default:({children}:{children:React.ReactNode})=><div>{children}</div>}));
jest.mock('../src/components/ui/QRCode',()=>({__esModule:true,default:({label}:{label:string})=><span role="img" aria-label={label}/> }));
const home='10000000-0000-4000-8000-000000000001',invite='10000000-0000-4000-8000-000000000002';
const vm=()=>({ready:true,busy:false,blocked:false,error:'',pending:null,context:null,review:null,lifetime:1,accountLabel:'Fixture owner',
  invitations:[],listError:'',shareToken:null,checkShare:jest.fn(),prepare:jest.fn(),refreshList:jest.fn(),acknowledge:jest.fn(),recover:jest.fn(),reopen:jest.fn()});
beforeEach(()=>jest.clearAllMocks());
test('shareable creation prepares exact dates with no link before saved proof',async()=>{
 const view=vm();jest.mocked(useSender).mockReturnValue(view as unknown as ReturnType<typeof useSender>);
 render(<InviteFlow open onClose={()=>{}} homeId={home}/>);
 fireEvent.change(screen.getByLabelText('Invite by'),{target:{value:'link'}});
 fireEvent.change(screen.getByLabelText('Role in household'),{target:{value:'airbnb_guest'}});
 fireEvent.change(screen.getByLabelText('Start date (optional)'),{target:{value:'2099-03-08'}});
 fireEvent.change(screen.getByLabelText('End date (inclusive, optional)'),{target:{value:'2099-03-08'}});
 fireEvent.click(screen.getByRole('button',{name:'Review invitation'}));
 await waitFor(()=>expect(view.prepare).toHaveBeenCalledWith({home_id:home,action:'create',payload:{relationship:'guest',preset_key:'airbnb_guest',
  start_at:new Date(2099,2,8).toISOString(),end_at:new Date(2099,2,9).toISOString()}}));
 expect(screen.queryByRole('img',{name:'Household invitation QR code'})).not.toBeInTheDocument();
});
test('saved username receipt survives failed refresh without claiming delivery',()=>{
 const view={...vm(),pending:{action:'create',home_id:home,request_id:'request',token:'capability',payload:{username:'recipient',relationship:'member'},
  outcome:{state:'completed',action:'create',invitation_id:invite,command:{request_id:'request'},delivery:{email:'unconfirmed',in_app:'unconfirmed'}}},canAcknowledge:true,
  listError:'Current invitations could not be loaded. Your saved result is kept.'};
 jest.mocked(useSender).mockReturnValue(view as unknown as ReturnType<typeof useSender>);
 render(<InviteFlow open onClose={()=>{}} homeId={home}/>);
 expect(screen.getByRole('heading',{name:'Invitation saved'})).toBeInTheDocument();
 expect(screen.getByText(/Email delivery is not confirmed/)).toBeInTheDocument();
 expect(screen.queryByText(/Invitation sent/)).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Done'})).toBeEnabled();
 expect(screen.queryByRole('link',{name:/capability/})).not.toBeInTheDocument();
});
test('sharing needs current pending proof and provider acceptance stays distinct from arrival',()=>{
 const view={...vm(),pending:{action:'resend',home_id:home,request_id:'request',token:'capability',reviewed_invitation:null,
  outcome:{state:'completed',action:'resend',invitation_id:invite,command:{request_id:'request'},delivery:{email:'provider_accepted',in_app:'saved'}}},canAcknowledge:true,shareToken:'capability',
  invitations:[{id:invite,home_id:home,status:'pending',proposed_role:'member'}]};
 jest.mocked(useSender).mockReturnValue(view as unknown as ReturnType<typeof useSender>);
 render(<InviteFlow open onClose={()=>{}} homeId={home}/>);
 expect(screen.getByRole('link',{name:/capability/})).toHaveAttribute('href',`${window.location.origin}/invite/capability`);
 expect(screen.getByRole('img',{name:'Household invitation QR code'})).toBeInTheDocument();
 expect(screen.getByText(/inbox delivery is not confirmed/)).toBeInTheDocument();
});

test('approved invitation review uses its effective role and a readable household label',()=>{
 const invitation={id:invite,home_id:home,status:'pending',proposed_role:'admin',proposed_role_base:'member',proposed_preset_key:'access_request:'+invite};
 const view={...vm(),context:{invitation},review:{action:'resend'}};
 jest.mocked(useSender).mockReturnValue(view as unknown as ReturnType<typeof useSender>);
 render(<InviteFlow open onClose={()=>{}} homeId={home}/>);
 expect(screen.getByText('Household approval (Member)')).toBeInTheDocument();
 expect(screen.queryByText(/Administrator|access_request:/)).not.toBeInTheDocument();
});
