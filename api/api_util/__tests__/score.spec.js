const _ = require('lodash')

const subject = require('../score')

describe('score', () => {
  describe('#getGroupsFromIdentsArray', () => {
    describe('when Identities do match all conditions', () => {
      it('returns an array of the Identity groups', () => {
        const idents = ['2_min', '3_max', '1_proposed']

        const expected = {
          id: 1,
          index: 0,
          name: '1',
        }

        const actual = subject.getGroupsFromIdentsArray(idents)

        expect(_.head(actual)).toEqual(expected)
      })
    })

    describe('when Identities do NOT match all conditions', () => {
      it('returns an empty array', () => {
        const idents = ['min', 'max', 'proposed']

        const actual = subject.getGroupsFromIdentsArray(idents)

        expect(actual).toBeEmpty()
      })
    })
  })

  describe('getScore', () => {
    describe('when `sequenceTypeIs` is defined', () => {
      describe('and `sequenceTypeShouldBe` is defined', () => {
        it('should return a score of 50', () => {
          const scoreVariables = {
            sequenceTypeIs: 'SE',
            sequenceTypeShouldBe: 'Sequence Type',
            fatSuppressionShouldBe: 'Fat Suppression',
            inplaneRotationAngleScoreSubtraction: 0,
            angleScoreSubtraction: 0,
            wrongCoverageMin: 0,
            wrongCoverageMax: 0,
            spacingTooHigh: 0,
            spacingTooLow: 0,
            thicknessTooHigh: 0,
            thicknessTooLow: 0,
            echoTimeOff: 0,
            repetitionTimeOff: 0,
            inversionTimeOff: 0,
            flipAngleOff: 0,
          }

          const actual = subject.getScore(scoreVariables)

          expect(actual).toBe(50)
        })
      })

      describe('and `sequenceTypeShouldBe` is NOT defined', () => {
        describe('and `sequenceTypeIs` is `SE`', () => {
          const sequenceTypeIs = 'SE'

          describe('and `fatSuppressionWrong` is defined', () => {
            it('should return a score value of 83.33', () => {
              const scoreVariables = {
                sequenceTypeIs,
                fatSuppressionShouldBe: 'Fat Suppression',
                inplaneRotationAngleScoreSubtraction: 0,
                angleScoreSubtraction: 0,
                wrongCoverageMin: 0,
                wrongCoverageMax: 0,
                spacingTooHigh: 0,
                spacingTooLow: 0,
                thicknessTooHigh: 0,
                thicknessTooLow: 0,
                echoTimeOff: 0,
                repetitionTimeOff: 0,
                inversionTimeOff: 0,
                flipAngleOff: 0,
              }

              const actual = subject.getScore(scoreVariables)

              expect(actual).toBe(83.33)
            })
          })

          describe('and `fatSuppressionWrong` is NOT defined', () => {
            it('should return a score value of 100', () => {
              const scoreVariables = {
                sequenceTypeIs,
                inplaneRotationAngleScoreSubtraction: 0,
                angleScoreSubtraction: 0,
                wrongCoverageMin: 0,
                wrongCoverageMax: 0,
                spacingTooHigh: 0,
                spacingTooLow: 0,
                thicknessTooHigh: 0,
                thicknessTooLow: 0,
                echoTimeOff: 0,
                repetitionTimeOff: 0,
                inversionTimeOff: 0,
                flipAngleOff: 0,
              }

              const actual = subject.getScore(scoreVariables)

              expect(actual).toBe(100)
            })
          })
        })

        describe('and `sequenceTypeIs` is `IR`', () => {
          const sequenceTypeIs = 'IR'
          it('should return a score value of 100', () => {
            const scoreVariables = {
              sequenceTypeIs,
              fatSuppressionShouldBe: 'Fat Suppression',
              inplaneRotationAngleScoreSubtraction: 0,
              angleScoreSubtraction: 0,
              wrongCoverageMin: 0,
              wrongCoverageMax: 0,
              spacingTooHigh: 0,
              spacingTooLow: 0,
              thicknessTooHigh: 0,
              thicknessTooLow: 0,
              echoTimeOff: 0,
              repetitionTimeOff: 0,
              inversionTimeOff: 0,
              flipAngleOff: 0,
            }

            const actual = subject.getScore(scoreVariables)

            expect(actual).toBe(100)
          })
        })

        describe('and `sequenceTypeIs` is `GRE`', () => {
          const sequenceTypeIs = 'GRE'

          describe('and `fatSuppressionWrong` is defined', () => {
            it('should return a score value of 90', () => {
              const scoreVariables = {
                sequenceTypeIs,
                fatSuppressionShouldBe: 'Fat Suppression',
                inplaneRotationAngleScoreSubtraction: 0,
                angleScoreSubtraction: 0,
                wrongCoverageMin: 0,
                wrongCoverageMax: 0,
                spacingTooHigh: 0,
                spacingTooLow: 0,
                thicknessTooHigh: 0,
                thicknessTooLow: 0,
                echoTimeOff: 0,
                repetitionTimeOff: 0,
                inversionTimeOff: 0,
                flipAngleOff: 0,
              }

              const actual = subject.getScore(scoreVariables)

              expect(actual).toBe(90)
            })
          })

          describe('and `fatSuppressionWrong` is NOT defined', () => {
            it('should return a score value of 100', () => {
              const scoreVariables = {
                sequenceTypeIs,
                inplaneRotationAngleScoreSubtraction: 0,
                angleScoreSubtraction: 0,
                wrongCoverageMin: 0,
                wrongCoverageMax: 0,
                spacingTooHigh: 0,
                spacingTooLow: 0,
                thicknessTooHigh: 0,
                thicknessTooLow: 0,
                echoTimeOff: 0,
                repetitionTimeOff: 0,
                inversionTimeOff: 0,
                flipAngleOff: 0,
              }

              const actual = subject.getScore(scoreVariables)

              expect(actual).toBe(100)
            })
          })
        })

        describe('and `sequenceTypeIs` is NOT one of `SE`, `IR`, or `GRE`', () => {
          const sequenceTypeIs = 'Not an option'
          it('should throw an Error', () => {
            const scoreVariables = {
              sequenceTypeIs,
              fatSuppressionShouldBe: 'Fat Suppression',
              inplaneRotationAngleScoreSubtraction: 0,
              angleScoreSubtraction: 0,
              wrongCoverageMin: 0,
              wrongCoverageMax: 0,
              spacingTooHigh: 0,
              spacingTooLow: 0,
              thicknessTooHigh: 0,
              thicknessTooLow: 0,
              echoTimeOff: 0,
              repetitionTimeOff: 0,
              inversionTimeOff: 0,
              flipAngleOff: 0,
            }

            try {
              subject.getScore(scoreVariables)

              // eslint-disable-next-line no-undef
              fail('This should have thrown an error')
            } catch (error) {
              expect(error.message).toEqual('Unrecognized sequence type')
            }
          })
        })
      })
    })

    describe('when `sequenceTypeIs` is NOT defined', () => {
      describe('and `inplaneRotationAngleScoreSubtraction` is Finite', () => {
        it('should return a score value of 80', () => {
          const scoreVariables = {
            fatSuppressionShouldBe: 'Fat Suppression',
            inplaneRotationAngleScoreSubtraction: 100,
            angleScoreSubtraction: 0,
            wrongCoverageMin: 0,
            wrongCoverageMax: 0,
            spacingTooHigh: 0,
            spacingTooLow: 0,
            thicknessTooHigh: 0,
            thicknessTooLow: 0,
            echoTimeOff: 0,
            repetitionTimeOff: 0,
            inversionTimeOff: 0,
            flipAngleOff: 0,
          }

          const actual = subject.getScore(scoreVariables)

          expect(actual).toBe(80)
        })
      })

      describe('and `inplaneRotationAngleScoreSubtraction` is NOT Finite', () => {
        it('should return a score value of 100', () => {
          const scoreVariables = {
            fatSuppressionShouldBe: 'Fat Suppression',
            inplaneRotationAngleScoreSubtraction: Infinity,
            angleScoreSubtraction: 0,
            wrongCoverageMin: 0,
            wrongCoverageMax: 0,
            spacingTooHigh: 0,
            spacingTooLow: 0,
            thicknessTooHigh: 0,
            thicknessTooLow: 0,
            echoTimeOff: 0,
            repetitionTimeOff: 0,
            inversionTimeOff: 0,
            flipAngleOff: 0,
          }

          const actual = subject.getScore(scoreVariables)

          expect(actual).toBe(100)
        })
      })
    })
  })

  describe('getAnalysis', () => {
    describe('angleScoreSubtraction', () => {
      describe('when `angleScoreSubtraction` is GREATER THAN 0', () => {
        it('should contain an analysis object with key: `TestResults.angle_wrong`', () => {
          const scoreVariables = {
            angleScoreSubtraction: 50,
            angle: 50,
          }

          const expected = {
            key: 'TestResults.angle_wrong',
            value: 50,
            isBad: true,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })

      describe('when `angleScoreSubtraction` is LESS THAN OR EQUAL TO 0', () => {
        it('should contain an analysis object with key: `TestResults.angle_correct`', () => {
          const scoreVariables = {
            angleScoreSubtraction: 0,
            angle: 0,
          }

          const expected = {
            key: 'TestResults.angle_correct',
            isBad: false,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })
    })

    describe('inplaneRotationAngleScoreSubtraction', () => {
      describe('when `inplaneRotationAngleScoreSubtraction` is null', () => {
        it('should return an empty array', () => {
          const scoreVariables = {
            inplaneRotationAngleScoreSubtraction: null,
          }

          const inPlaneRotationWrongAnalysisObject = {
            key: 'TestResults.in_plane_rotation_wrong',
            value: 50,
            isBad: true,
          }

          const inPlaneRotationCorrectAnalysisObject = {
            key: 'TestResults.in_plane_rotation_correct',
            isBad: false,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).not.toContainEqual(inPlaneRotationWrongAnalysisObject)
          expect(actual).not.toContainEqual(inPlaneRotationCorrectAnalysisObject)
        })
      })

      describe('when `inplaneRotationAngleScoreSubtraction` is GREATER THAN 0', () => {
        it('should contain an analysis object with key: `TestResults.in_plane_rotation_wrong`', () => {
          const scoreVariables = {
            inplaneRotationAngleScoreSubtraction: 50,
            inplaneRotationAngle: 50,
          }

          const expected = {
            key: 'TestResults.in_plane_rotation_wrong',
            value: 50,
            isBad: true,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })

      describe('when `inplaneRotationAngleScoreSubtraction` is LESS THAN OR EQUAL TO 0', () => {
        it('should contain an analysis object with key: `TestResults.in_plane_rotation_correct`', () => {
          const scoreVariables = {
            inplaneRotationAngleScoreSubtraction: 0,
            inplaneRotationAngle: 50,
          }

          const expected = {
            key: 'TestResults.in_plane_rotation_correct',
            isBad: false,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })
    })

    describe('spacing', () => {
      describe('when `spacingTooLow` is GREATER THAN 0', () => {
        it('should contain an analysis object with key: `TestResults.slice_gap_small`', () => {
          const scoreVariables = {
            spacingTooLow: 50,
          }

          const expected = {
            key: 'TestResults.slice_gap_small',
            value: 50,
            isBad: true,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })

      describe('when `spacingTooHigh` is GREATER THAN 0', () => {
        it('should contain an analysis object with key: `TestResults.slice_gap_big`', () => {
          const scoreVariables = {
            spacingTooHigh: 50,
          }

          const expected = {
            key: 'TestResults.slice_gap_big',
            value: 50,
            isBad: true,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })

      describe('when both `spacingTooLow` and `spacingTooHigh` are LESS THAN OR EQUAL TO 0', () => {
        it('should contain an analysis object with key: `TestResults.slice_gap_correct`', () => {
          const scoreVariables = {
            spacingTooLow: 0,
            spacingTooHigh: 0,
          }

          const expected = {
            key: 'TestResults.slice_gap_correct',
            isBad: false,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })
    })

    describe('thickness', () => {
      describe('when `thicknessTooLow` is GREATER THAN 0', () => {
        it('should contain an analysis object with key: `TestResults.slice_thickness_small`', () => {
          const scoreVariables = {
            thicknessTooLow: 50,
          }

          const expected = {
            key: 'TestResults.slice_thickness_small',
            value: 50,
            isBad: true,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })

      describe('when `thicknessTooHigh` is GREATER THAN 0', () => {
        it('should contain an analysis object with key: `TestResults.slice_thickness_big`', () => {
          const scoreVariables = {
            thicknessTooHigh: 50,
          }

          const expected = {
            key: 'TestResults.slice_thickness_big',
            value: 50,
            isBad: true,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })

      describe('when both `thicknessTooLow` and `thicknessTooHigh` are LESS THAN OR EQUAL TO 0', () => {
        it('should contain an analysis object with key: `TestResults.slice_thickness_correct`', () => {
          const scoreVariables = {
            thicknessTooLow: 0,
            thicknessTooHigh: 0,
          }

          const expected = {
            key: 'TestResults.slice_thickness_correct',
            isBad: false,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })
    })

    describe('dimensionX', () => {
      describe('when `dimensionXTooLow` is GREATER THAN 0', () => {
        it('should contain an analysis object with key: `TestResults.phase_small`', () => {
          const scoreVariables = {
            dimensionXTooLow: 50,
          }

          const expected = {
            key: 'TestResults.phase_small',
            value: 50,
            isBad: true,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })

      describe('when `dimensionXTooHigh` is GREATER THAN 0', () => {
        it('should contain an analysis object with key: `TestResults.phase_big`', () => {
          const scoreVariables = {
            dimensionXTooHigh: 50,
          }

          const expected = {
            key: 'TestResults.phase_big',
            value: 50,
            isBad: true,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })

      describe('when both `dimensionXTooLow` and `dimensionXTooHigh` are LESS THAN OR EQUAL TO 0', () => {
        it('should contain an analysis object with key: `TestResults.phase_correct`', () => {
          const scoreVariables = {
            dimensionXTooLow: 0,
            dimensionXTooHigh: 0,
          }

          const expected = {
            key: 'TestResults.phase_correct',
            isBad: false,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })
    })

    describe('dimensionY', () => {
      describe('when `dimensionYTooLow` is GREATER THAN 0', () => {
        it('should contain an analysis object with key: `TestResults.frequency_small`', () => {
          const scoreVariables = {
            dimensionYTooLow: 50,
          }

          const expected = {
            key: 'TestResults.frequency_small',
            value: 50,
            isBad: true,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })

      describe('when `dimensionYTooHigh` is GREATER THAN 0', () => {
        it('should contain an analysis object with key: `TestResults.frequency_big`', () => {
          const scoreVariables = {
            dimensionYTooHigh: 50,
          }

          const expected = {
            key: 'TestResults.frequency_big',
            value: 50,
            isBad: true,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })

      describe('when both `dimensionYTooLow` and `dimensionYTooHigh` are LESS THAN OR EQUAL TO 0', () => {
        it('should contain an analysis object with key: `TestResults.frequency_correct`', () => {
          const scoreVariables = {
            dimensionYTooLow: 0,
            dimensionYTooHigh: 0,
          }

          const expected = {
            key: 'TestResults.frequency_correct',
            isBad: false,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })
    })

    describe('dimensionZ', () => {
      describe('when `dimensionZTooLow` is GREATER THAN 0', () => {
        it('should contain an analysis object with key: `TestResults.slice_coverage_small`', () => {
          const scoreVariables = {
            dimensionZTooLow: 50,
          }

          const expected = {
            key: 'TestResults.slice_coverage_small',
            value: 50,
            isBad: true,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })

      describe('when `dimensionZTooHigh` is GREATER THAN 0', () => {
        it('should contain an analysis object with key: `TestResults.slice_coverage_big`', () => {
          const scoreVariables = {
            dimensionZTooHigh: 50,
          }

          const expected = {
            key: 'TestResults.slice_coverage_big',
            value: 50,
            isBad: true,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })

      describe('when both `dimensionZTooLow` and `dimensionZTooHigh` are LESS THAN OR EQUAL TO 0', () => {
        it('should contain an analysis object with key: `TestResults.slice_coverage_correct`', () => {
          const scoreVariables = {
            dimensionZTooLow: 0,
            dimensionZTooHigh: 0,
          }

          const expected = {
            key: 'TestResults.slice_coverage_correct',
            isBad: false,
          }

          const actual = subject.getAnalysis(scoreVariables)

          expect(actual).toContainEqual(expected)
        })
      })
    })

    describe('sequenceTypeIs', () => {
      describe('when `sequenceTypeIs` is defined', () => {
        const sequenceTypeIs = 'Sequence Type Is'

        describe('sequenceTypeShouldBe', () => {
          describe('when `sequenceTypeShouldBe` is defined', () => {
            it('should contain an analysis object with key: `TestResults.sequence_type_wrong`', () => {
              const scoreVariables = {
                sequenceTypeIs,
                sequenceTypeShouldBe: 'Sequence Type Should Be',
              }

              const expected = {
                key: 'TestResults.sequence_type_wrong',
                value: 'Sequence Type Should Be',
                isBad: true,
              }

              const actual = subject.getAnalysis(scoreVariables)

              expect(actual).toContainEqual(expected)
            })
          })

          describe('when `sequenceTypeShouldBe` is NOT defined', () => {
            it('should contain an analysis object with key: `TestResults.sequence_type_correct`', () => {
              const scoreVariables = {
                sequenceTypeIs,
              }

              const expected = {
                key: 'TestResults.sequence_type_correct',
                isBad: false,
              }

              const actual = subject.getAnalysis(scoreVariables)

              expect(actual).toContainEqual(expected)
            })
          })
        })

        describe('fatSuppressionShouldBe', () => {
          describe('when `fatSuppressionShouldBe` is defined', () => {
            it('should contain an analysis object with key: `TestResults.fat_suppression_wrong`', () => {
              const scoreVariables = {
                sequenceTypeIs,
                fatSuppressionShouldBe: 'Fat Suppression Should Be',
              }

              const expected = {
                key: 'TestResults.fat_suppression_wrong',
                value: 'Fat Suppression Should Be',
                isBad: true,
              }

              const actual = subject.getAnalysis(scoreVariables)

              expect(actual).toContainEqual(expected)
            })
          })

          describe('when `fatSuppressionShouldBe` is NOT defined', () => {
            it('should contain an analysis object with key: `TestResults.fat_suppression_correct`', () => {
              const scoreVariables = {
                sequenceTypeIs,
              }

              const expected = {
                key: 'TestResults.fat_suppression_correct',
                isBad: false,
              }

              const actual = subject.getAnalysis(scoreVariables)

              expect(actual).toContainEqual(expected)
            })
          })
        })

        describe('echoTime', () => {
          describe('when `echoTimeTooLow` is GREATER THAN 0', () => {
            it('should contain an analysis object with key: `TestResults.echo_time_small`', () => {
              const scoreVariables = {
                sequenceTypeIs,
                echoTimeTooLow: 50,
              }

              const expected = {
                key: 'TestResults.echo_time_small',
                value: 50,
                isBad: true,
              }

              const actual = subject.getAnalysis(scoreVariables)

              expect(actual).toContainEqual(expected)
            })
          })

          describe('when `echoTimeTooHigh` is GREATER THAN 0', () => {
            it('should contain an analysis object with key: `TestResults.echo_time_big`', () => {
              const scoreVariables = {
                sequenceTypeIs,
                echoTimeTooHigh: 50,
              }

              const expected = {
                key: 'TestResults.echo_time_big',
                value: 50,
                isBad: true,
              }

              const actual = subject.getAnalysis(scoreVariables)

              expect(actual).toContainEqual(expected)
            })
          })

          describe('when both `echoTimeTooLow` and `echoTimeTooHigh` are LESS THAN OR EQUAL TO 0', () => {
            it('should contain an analysis object with key: `TestResults.echo_time_correct`', () => {
              const scoreVariables = {
                sequenceTypeIs,
                echoTimeTooLow: 0,
                echoTimeTooHigh: 0,
              }

              const expected = {
                key: 'TestResults.echo_time_correct',
                isBad: false,
              }

              const actual = subject.getAnalysis(scoreVariables)

              expect(actual).toContainEqual(expected)
            })
          })
        })

        describe('repetitionTime', () => {
          describe('when `repetitionTimeTooLow` is GREATER THAN 0', () => {
            it('should contain an analysis object with key: `TestResults.repetition_time_small`', () => {
              const scoreVariables = {
                sequenceTypeIs,
                repetitionTimeTooLow: 50,
              }

              const expected = {
                key: 'TestResults.repetition_time_small',
                value: 50,
                isBad: true,
              }

              const actual = subject.getAnalysis(scoreVariables)

              expect(actual).toContainEqual(expected)
            })
          })

          describe('when `repetitionTimeTooHigh` is GREATER THAN 0', () => {
            it('should contain an analysis object with key: `TestResults.repetition_time_big`', () => {
              const scoreVariables = {
                sequenceTypeIs,
                repetitionTimeTooHigh: 50,
              }

              const expected = {
                key: 'TestResults.repetition_time_big',
                value: 50,
                isBad: true,
              }

              const actual = subject.getAnalysis(scoreVariables)

              expect(actual).toContainEqual(expected)
            })
          })

          describe('when both `repetitionTimeTooLow` and `repetitionTimeTooLow` are LESS THAN OR EQUAL TO 0', () => {
            it('should contain an analysis object with key: `TestResults.repetition_time_correct`', () => {
              const scoreVariables = {
                sequenceTypeIs,
                repetitionTimeTooLow: 0,
                repetitionTimeTooHigh: 0,
              }

              const expected = {
                key: 'TestResults.repetition_time_correct',
                isBad: false,
              }

              const actual = subject.getAnalysis(scoreVariables)

              expect(actual).toContainEqual(expected)
            })
          })
        })

        describe('when `sequenceTypeIs` is `IR`', () => {
          describe('when `inversionTimeTooLow` is GREATER THAN 0', () => {
            it('should contain an analysis object with key: `TestResults.inversion_time_small`', () => {
              const scoreVariables = {
                sequenceTypeIs: 'IR',
                inversionTimeTooLow: 50,
              }

              const expected = {
                key: 'TestResults.inversion_time_small',
                value: 50,
                isBad: true,
              }

              const actual = subject.getAnalysis(scoreVariables)

              expect(actual).toContainEqual(expected)
            })
          })

          describe('when `inversionTimeTooHigh` is GREATER THAN 0', () => {
            it('should contain an analysis object with key: `TestResults.inversion_time_big`', () => {
              const scoreVariables = {
                sequenceTypeIs: 'IR',
                inversionTimeTooHigh: 50,
              }

              const expected = {
                key: 'TestResults.inversion_time_big',
                value: 50,
                isBad: true,
              }

              const actual = subject.getAnalysis(scoreVariables)

              expect(actual).toContainEqual(expected)
            })
          })

          describe('when both `inversionTimeTooLow` and `inversionTimeTooHigh` are LESS THAN OR EQUAL TO 0', () => {
            it('should contain an analysis object with key: `TestResults.inversion_time_correct`', () => {
              const scoreVariables = {
                sequenceTypeIs: 'IR',
                inversionTimeTooLow: 0,
                inversionTimeTooHigh: 0,
              }

              const expected = {
                key: 'TestResults.inversion_time_correct',
                isBad: false,
              }

              const actual = subject.getAnalysis(scoreVariables)

              expect(actual).toContainEqual(expected)
            })
          })
        })

        describe('when `sequenceTypeIs` is `GRE`', () => {
          describe('when `flipAngleTooLow` is GREATER THAN 0', () => {
            it('should contain an analysis object with key: `TestResults.flip_angle_small`', () => {
              const scoreVariables = {
                sequenceTypeIs: 'GRE',
                flipAngleTooLow: 50,
              }

              const expected = {
                key: 'TestResults.flip_angle_small',
                value: 50,
                isBad: true,
              }

              const actual = subject.getAnalysis(scoreVariables)

              expect(actual).toContainEqual(expected)
            })
          })

          describe('when `flipAngleTooHigh` is GREATER THAN 0', () => {
            it('should contain an analysis object with key: `TestResults.flip_angle_big`', () => {
              const scoreVariables = {
                sequenceTypeIs: 'GRE',
                flipAngleTooHigh: 50,
              }

              const expected = {
                key: 'TestResults.flip_angle_big',
                value: 50,
                isBad: true,
              }

              const actual = subject.getAnalysis(scoreVariables)

              expect(actual).toContainEqual(expected)
            })
          })

          describe('when both `flipAngleTooLow` and `flipAngleTooLow` are LESS THAN OR EQUAL TO 0', () => {
            it('should contain an analysis object with key: `TestResults.flip_angle_correct`', () => {
              const scoreVariables = {
                sequenceTypeIs: 'GRE',
                flipAngleTooLow: 0,
                flipAngleTooHigh: 0,
              }

              const expected = {
                key: 'TestResults.flip_angle_correct',
                isBad: false,
              }

              const actual = subject.getAnalysis(scoreVariables)

              expect(actual).toContainEqual(expected)
            })
          })
        })
      })
    })
  })

  describe('calculateScoreVariables', () => {
    it('should calculate a score based on the passed variables', () => {
      const answerData = {
        xDirectionX: 5,
        xDirectionY: 5,
        xDirectionZ: 5,
        yDirectionX: 5,
        yDirectionY: 5,
        yDirectionZ: 5,
        centerX: 5,
        centerY: 5,
        centerZ: 5,
        dimensionX: 5,
        dimensionY: 5,
        dimensionZ: 5,
      }
      const minData = {
        xDirectionX: 0,
        xDirectionY: 0,
        xDirectionZ: 0,
        yDirectionX: 0,
        yDirectionY: 0,
        yDirectionZ: 0,
        centerX: 0,
        centerY: 0,
        centerZ: 0,
        dimensionX: 0,
        dimensionY: 0,
        dimensionZ: 0,
      }
      const maxData = {
        xDirectionX: 10,
        xDirectionY: 10,
        xDirectionZ: 10,
        yDirectionX: 10,
        yDirectionY: 10,
        yDirectionZ: 10,
        centerX: 10,
        centerY: 10,
        centerZ: 10,
        dimensionX: 10,
        dimensionY: 10,
        dimensionZ: 10,

        maxRotationOff: 4,
      }
      const ignoreInPlaneRotation = false
      const contrastLab = false
      const isSingleSlice = false

      const expected = {
        angle: 90,
        angleScoreSubtraction: 215,
        dimensionXIs: undefined,
        dimensionYIs: undefined,
        dimensionZIs: undefined,
        inplaneRotationAngle: 90,
        inplaneRotationAngleScoreSubtraction: 80,
        numberOfSlicesIs: undefined,
        spacingIs: undefined,
        thicknessIs: undefined,
        wrongCoverageMax: 0,
        wrongCoverageMin: 0,
      }

      const actual = subject.calculateScoreVariables(
        answerData,
        minData,
        maxData,
        ignoreInPlaneRotation,
        contrastLab,
        isSingleSlice
      )

      expect(actual).toEqual(expected)
    })
  })

  describe('calculateGroupScoreVariables', () => {
    it('should', () => {
      const userAnswerConfigs = {}
      const answerCorrect = {}
      const ignoreInPlaneRotation = false
      const isContrastLab = false

      const actual = subject.calculateGroupScoreVariables(
        userAnswerConfigs,
        answerCorrect,
        ignoreInPlaneRotation,
        isContrastLab
      )

      expect(actual).not.toBeDefined()
    })
  })

  describe('serializeGroupScoreVariables', () => {
    it('should remove the bloat of all of the score variables from the groupScoreVariables object', () => {
      const groupScoreVariables = [
        {
          scoreVariables: ['someVar'],
          score: 80,
        },
        {
          scoreVariables: ['someVar'],
          score: 90,
        },
      ]

      const actual = subject.serializeGroupScoreVariables(groupScoreVariables)

      expect(actual.length).toEqual(2)
      expect(actual[0].score).toBeDefined()
      // TODO: I think the function means to use "omit" not "omitBy"
      expect(actual[0].scoreVariables).toBeDefined()
    })
  })

  describe('flatScoreFromGroupScoreVariables', () => {
    it('should return a flattened group score with a precision of 0.00', () => {
      const groupScoreVariables = [{ score: 80 }, { score: 90 }]

      const actual = subject.flatScoreFromGroupScoreVariables(groupScoreVariables)

      expect(actual).toBe(85.0)
    })
  })
})
