/** Backend `shared/pagination/Page<T>` (0-based `page`). Every list endpoint returns this. */
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
