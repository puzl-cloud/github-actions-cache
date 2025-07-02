# puzl.cloud restore action

The restore action restores a cache. It works similarly to the cache action except that it doesn't have a post step to
save the cache. It accepts the same set of inputs as the cache action.

## Usage

### Pre-requisites

Create a workflow `.yml` file in your repositories `.github/workflows` directory.
An [example workflow](#example-workflow) is available below. For more information, reference the GitHub Help
Documentation
for [Creating a workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

### Inputs

* `path` - A list of files, directories, and wildcard patterns to restore cache. See [
  `@actions/glob`](https://github.com/actions/toolkit/tree/main/packages/glob) for supported patterns.
* `key` - An explicit key for restoring the cache.
* `restore-keys` - An ordered list of prefix-matched keys to use for restoring stale cache if no cache hit occurred for
  key.

### Outputs

* `cache-hit` - A boolean value to indicate an exact match was found for the key.

> Note: `cache-hit` will be set to `true` only when cache hit occurs for the exact `key` match. For a partial key match
> via `restore-keys` or a cache miss, it will be set to `false`.

See [Skipping steps based on cache-hit](#skipping-steps-based-on-cache-hit) for info on using this output

### Example workflow

#### Only restore cache

```yaml
steps:
  - uses: actions/checkout@v4

  - uses: puzl-cloud/github-actions-cache/restore@v4
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}

  - name: Install Dependencies
    if: steps.cache.outputs.cache-hit != 'true'
    run: /install.sh

  - name: Build
    run: /build.sh

  - name: Publish package to public
    run: /publish.sh
```

