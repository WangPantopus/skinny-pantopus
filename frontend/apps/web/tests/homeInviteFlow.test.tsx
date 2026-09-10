import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TextEncoder } from 'util';
import InviteFlow from '../src/components/home/members/InviteFlow';
jest.mock('@pantopus/api',()=>({homeIam:{getRolePresets:jest.fn(async()=>({presets:[]}))}}));
jest.mock('../src/components/home/SlidePanel',()=>({__esModule:true,default:({children}:{children:React.ReactNode})=><div>{children}</div>}));
beforeAll(()=>{Object.defineProperty(globalThis,'TextEncoder',{configurable:true,value:TextEncoder});});

test('QR invitation is created first and returned token survives to the displayed link and QR',async()=>{
 const token='actual-created-token-123';
 const onInvite=jest.fn(async()=>({invitation:{id:'invite',token,home_id:'home',proposed_role:'guest'},emailSent:false}));
 render(<InviteFlow open onClose={()=>{}} onInvite={onInvite} homeId="home-id-is-not-a-token"/>);
 fireEvent.click(screen.getByRole('button',{name:/QR Code/}));
 fireEvent.click(screen.getByRole('button',{name:/Next/}));
 expect(screen.queryByRole('img',{name:'Invitation QR code'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/Airbnb/}));
 fireEvent.change(screen.getByLabelText('Start date'),{target:{value:'2099-03-08'}});
 fireEvent.change(screen.getByLabelText('End date (inclusive)'),{target:{value:'2099-03-08'}});
 fireEvent.click(screen.getByRole('button',{name:'Next: Review'}));
 fireEvent.click(screen.getByRole('button',{name:'Send Invitation'}));
 const url=`${window.location.origin}/invite/${token}`;
 await waitFor(()=>expect(screen.getByRole('link')).toHaveAttribute('href',url));
 expect(screen.getByRole('img',{name:'Invitation QR code'})).toBeInTheDocument();
 expect(onInvite).toHaveBeenCalledWith(expect.objectContaining({relationship:'guest',preset_key:'airbnb_guest',
  start_at:new Date(2099,2,8).toISOString(),end_at:new Date(2099,2,9).toISOString()}));
 expect(onInvite).toHaveBeenCalledTimes(1);
});

test('email unavailable reports a created invitation and useful link without claiming delivery',async()=>{
 const onInvite=jest.fn(async()=>({invitation:{id:'invite',token:'email-token',home_id:'home',proposed_role:'member'},emailSent:false}));
 const {container}=render(<InviteFlow open onClose={()=>{}} onInvite={onInvite} homeId="home"/>);
 fireEvent.change(container.querySelector('input[type=email]')!,{target:{value:'synthetic@example.invalid'}});
 fireEvent.click(screen.getByRole('button',{name:/Next/}));
 fireEvent.click(screen.getByRole('button',{name:'Next: Review'}));
 fireEvent.click(screen.getByRole('button',{name:'Send Invitation'}));
 expect(await screen.findByText(/Email delivery was not confirmed/)).toBeInTheDocument();
 expect(screen.queryByText(/Invitation sent to/)).not.toBeInTheDocument();
 expect(screen.getByRole('link')).toHaveAttribute('href',`${window.location.origin}/invite/email-token`);
});
