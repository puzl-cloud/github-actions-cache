/**
 * Custom Jest resolver for ESM-only packages.
 *
 * Packages like @actions/core 3.x declare "type": "module" with an exports
 * map that only has an "import" condition. Jest's default CJS resolver cannot
 * resolve them. This resolver falls back to the "main" field when the exports
 * map resolution fails.
 */
module.exports = (path, options) => {
    try {
        return options.defaultResolver(path, options);
    } catch {
        return options.defaultResolver(path, {
            ...options,
            packageFilter: (pkg) => {
                if (pkg.type === "module" && pkg.exports) {
                    delete pkg.exports;
                }

                return pkg;
            }
        });
    }
};
