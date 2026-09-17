import { Pipe, PipeTransform } from '@angular/core';

/**
 * Joins the parts of an address that are actually present, so a missing
 * locality does not leave a dangling comma in the line.
 */
@Pipe({ name: 'joinParts', standalone: true })
export class JoinPartsPipe implements PipeTransform {
  transform(parts: (string | null | undefined)[], separator = ', '): string {
    return parts.filter(part => !!part && part.trim().length > 0).join(separator);
  }
}
