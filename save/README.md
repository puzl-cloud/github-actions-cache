# puzl.cloud save action

The save action saves a cache. It works similarly to the cache action except that it doesn't first do a restore. This
action provides granular ability to save a cache without having to restore it, or to do a save at any stage of the
workflow job -- not only in post phase.

### Inputs

* `path` - A list of files, directories, and wildcard patterns to cache. See [
  `@actions/glob`](https://github.com/actions/toolkit/tree/main/packages/glob) for supported patterns.
* `key` - An explicit key for saving the cache.

### Outputs

This action has no outputs.

### Example workflow

#### Only save cache

```yaml
steps:
  - uses: actions/checkout@v4

  - name: Install Dependencies
    run: /install.sh

  - name: Build artifacts
    run: /build.sh

  - uses: puzl-cloud/github-actions-cache/save@v4
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```