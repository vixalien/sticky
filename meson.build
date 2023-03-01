project('sticky-notes',
          version: '0.1.0',
    meson_version: '>= 0.62.0',
  default_options: [ 'warning_level=2', 'werror=false', ],
)

i18n = import('i18n')
gnome = import('gnome')

gjs_dep = dependency('gjs-1.0', version: '>= 1.54.0')
gjs_console = gjs_dep.get_variable(pkgconfig: 'gjs_console')

pm_name = 'yarn'

package_manager = find_program(pm_name, '/usr/local/bin/yarn', required: true)

package_manager_args = ['--cwd', meson.project_build_root()]

offline_mirror = get_option('offline-mirror')
if pm_name == 'yarn' and offline_mirror != ''
  configure_file(input: 'empty_file',
    output: meson.current_source_dir() / '.yarnrc',
    capture: true,
    command: [
      '/bin/echo',
      'yarn-offline-mirror ' + offline_mirror
    ])

  # run_command(
  #   package_manager,
  #   'config',
  #   '--offline',
  #   'set',
  #   'yarn-offline-mirror',
  #   offline_mirror,
  #   env: { 'HOME': meson.current_source_dir() },
  #   check: true
  # )

  package_manager_args += [
    # note that this does not affect network requests, as it's getting them from
    # the offline mirror
    '--network-concurrency 1',
    '--offline',
    '--use-yarnrc', meson.current_source_dir() / '.yarnrc'
  ]
endif

package_manager_deps = custom_target(
  'node-package-manager-deps',
  command: [ package_manager, 'install', package_manager_args ],
  output: ['node-package-manager-out']
)

subdir('data')
subdir('src')
subdir('po')

gnome.post_install(
     glib_compile_schemas: true,
    gtk_update_icon_cache: true,
  update_desktop_database: true,
)
