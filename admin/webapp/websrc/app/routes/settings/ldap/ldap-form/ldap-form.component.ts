import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  ErrorResponse,
  GroupMappedRole,
  LDAP,
  ServerGetResponse,
  ServerPatchBody,
} from '@common/types';
import { SettingsService } from '@services/settings.service';
import { finalize } from 'rxjs/operators';
import { TestConnectionDialogComponent } from '../test-connection-dialog/test-connection-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { UtilsService } from '@common/utils/app.utils';
import { NotificationService } from '@services/notification.service';
import { Observable } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-ldap-form',
  templateUrl: './ldap-form.component.html',
  styleUrls: ['./ldap-form.component.scss'],
})
export class LdapFormComponent implements OnInit, OnChanges {
  @Input() ldapData!: { server: ServerGetResponse; domains: string[] };
  @Output() refresh = new EventEmitter();
  onCreate = true;
  submittingForm = false;
  groupMappedRoles: GroupMappedRole[] = [];
  serverName = 'ldap1';
  passwordVisible = false;
  ldapForm = new FormGroup({
    directory: new FormControl(),
    hostname: new FormControl(null, Validators.required),
    port: new FormControl(),
    ssl: new FormControl(),
    bind_dn: new FormControl(),
    bind_password: new FormControl(),
    base_dn: new FormControl(null, Validators.required),
    username_attr: new FormControl(),
    group_member_attr: new FormControl(),
    default_role: new FormControl(),
    enable: new FormControl(false),
  });

  constructor(
    private settingsService: SettingsService,
    private dialog: MatDialog,
    private notificationService: NotificationService,
    private utils: UtilsService,
    private tr: TranslateService
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ldapData) {
      this.initForm();
    }
  }

  initForm(): void {
    const ldap = this.ldapData.server.servers.find(
      ({ server_type }) => server_type === 'ldap'
    );
    if (ldap && ldap.ldap) {
      this.serverName = ldap.server_name;
      this.groupMappedRoles = ldap.ldap.group_mapped_roles;
      Object.keys(ldap.ldap).forEach((key: string) => {
        if (this.ldapForm.controls[key]) {
          this.ldapForm.controls[key].setValue(
            ldap.ldap ? ldap.ldap[key] : null
          );
        }
      });
    } else {
      this.onCreate = false;
    }
  }

  submitForm(): void {
    if (!this.ldapForm.valid) {
      return;
    }
    const ldap: LDAP = {
      group_mapped_roles: this.groupMappedRoles,
      ...this.ldapForm.value,
    };
    const config: ServerPatchBody = { config: { name: this.serverName, ldap } };
    this.submittingForm = true;
    let submission: Observable<unknown>;
    if (!this.onCreate) {
      submission = this.settingsService.postServer(config).pipe(
        finalize(() => {
          this.submittingForm = false;
          this.onCreate = true;
        })
      );
    } else {
      submission = this.settingsService.patchServer(config).pipe(
        finalize(() => {
          this.submittingForm = false;
        })
      );
    }
    submission.subscribe({
      complete: () => {
        this.notificationService.open(this.tr.instant('ldap.SERVER_SAVED'));
        this.refresh.emit();
      },
      error: ({ error }: { error: ErrorResponse }) => {
        this.notificationService.open(
          this.utils.getAlertifyMsg(
            error,
            this.tr.instant('ldap.SERVER_SAVE_FAILED'),
            false
          )
        );
      },
    });
  }

  openDialog(): void {
    const ldap: LDAP = {
      group_mapped_roles: this.groupMappedRoles,
      ...this.ldapForm.value,
    };
    this.dialog.open(TestConnectionDialogComponent, {
      width: '60%',
      data: {
        ldap,
        name: this.serverName,
      },
    });
  }

  updateGroupMappedRoles(newGroupMappedRoles: GroupMappedRole[]): void {
    this.groupMappedRoles = newGroupMappedRoles;
  }
}
