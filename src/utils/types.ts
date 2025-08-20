export type FlattenUnion<U> = {
  [K in U extends unknown ? keyof U : never]?: U extends { [P in K]?: infer V }
    ? V
    : never;
};
