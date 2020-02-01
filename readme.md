## Deploy

Prerequisites: `git` + `git bash for windows` + `nodejs > 12.x`

- decrypt config.json (in git bash)

```bash
# Windows: Use Git Bash
./transcrypt.sh -c aes-256-cbc -p 'my password'
```

- Update **hostName** in config.json

- Run `npm install` and `node ./`
