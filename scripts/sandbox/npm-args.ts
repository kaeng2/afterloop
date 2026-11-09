/**
 * `--` 없이 준 옵션 막기 (T030, SPEC v2.2 9-5장).
 *
 * `npm run sandbox:orders --fresh`처럼 `--` 앞에 옵션을 주면 npm이 그 옵션을 **자기 설정으로 삼켜**
 * 스크립트에 넘기지 않는다. 사람은 `--fresh`를 줬다고 믿지만 스크립트는 인자 없는 기본 경로를 돈다
 * (T029 검증 보고서 문제 3). npm은 삼킨 옵션을 `npm_config_<이름>` 환경 변수에 남기므로,
 * "인자에는 없는데 환경 변수에는 있는" 옵션이 보이면 아무것도 호출하지 않고 멈춘다.
 *
 * 비밀값은 다루지 않는다 (옵션 이름만 본다).
 */

/** 환경 변수 묶음 (`process.env`도 이 꼴이다. 테스트는 필요한 키만 담은 객체를 넘긴다). */
export type EnvVars = Record<string, string | undefined>;

/**
 * npm이 쓸 수 있는 환경 변수 이름들. npm 버전에 따라 `-`를 그대로 두거나 `_`로 바꾼다 —
 * 둘 다 본다 (`--probe-request-id` → `npm_config_probe-request-id`, `npm_config_probe_request_id`).
 */
export function npmConfigKeys(flag: string): string[] {
  const name = flag.replace(/^--/, '');
  const underscored = name.replace(/-/g, '_');
  return name === underscored ? [`npm_config_${name}`] : [`npm_config_${name}`, `npm_config_${underscored}`];
}

/** 인자로는 오지 않았는데 npm 환경 변수에만 있는 옵션들 (= npm이 삼킨 옵션). */
export function swallowedOptions(flags: string[], args: string[], env: EnvVars = process.env): string[] {
  return flags.filter(
    (flag) => !args.includes(flag) && npmConfigKeys(flag).some((key) => (env[key] ?? '') !== ''),
  );
}

/** 사람에게 보여 줄 한 줄 + 왜 멈췄는지. 삼킨 옵션 이름만 담는다. */
export function swallowedOptionsMessage(script: string, swallowed: string[]): string {
  return [
    `옵션은 \`--\` 뒤에: npm run ${script} -- ${swallowed.join(' ')}`,
    `(npm이 \`--\` 앞의 ${swallowed.join(' ')}를 삼켜 스크립트에 넘기지 않았다. 아무것도 호출하지 않고 멈춘다.)`,
  ].join('\n');
}

/**
 * 삼킨 옵션이 있으면 보여 줄 문구를, 없으면 `undefined`를 돌려준다.
 * 호출하는 쪽은 문구가 있으면 **자격 증명을 읽기 전에** 종료 코드 1로 멈춘다.
 */
export function swallowedOptionsError(
  script: string,
  flags: string[],
  args: string[],
  env: EnvVars = process.env,
): string | undefined {
  const swallowed = swallowedOptions(flags, args, env);
  return swallowed.length === 0 ? undefined : swallowedOptionsMessage(script, swallowed);
}
