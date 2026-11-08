/** A business location's street line with its suite, as the owner typed it: "805 Broadway Street, Suite 500". */
export function streetLine(location: { address?: string | null; address2?: string | null }): string {
  return [location.address, location.address2].map((part) => part?.trim()).filter(Boolean).join(', ');
}
